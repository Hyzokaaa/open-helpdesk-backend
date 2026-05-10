import {
  Controller,
  Get,
  Inject,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { CsatRating } from '../../../domain/enums/csat-rating.enum';
import { TypeOrmCsatResponseRepository } from '../../typeorm/repositories/typeorm-csat-response.repository';

const VALID_RATINGS = Object.values(CsatRating);

const RATING_EMOJI: Record<string, string> = {
  good: '😊',
  neutral: '😐',
  bad: '😞',
};

function thankYouHtml(alreadyResponded: boolean, lang: string): string {
  const title = alreadyResponded
    ? (lang === 'es' ? 'Ya recibimos tu respuesta' : 'Already received')
    : (lang === 'es' ? '¡Gracias por tu respuesta!' : 'Thank you for your feedback!');
  const message = alreadyResponded
    ? (lang === 'es' ? 'Ya habías respondido esta encuesta anteriormente.' : 'You have already responded to this survey.')
    : (lang === 'es' ? 'Tu opinión nos ayuda a mejorar.' : 'Your feedback helps us improve.');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb;">
<div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px;">
<p style="font-size: 48px; margin: 0 0 16px;">✅</p>
<h1 style="font-size: 20px; color: #111; margin: 0 0 8px;">${title}</h1>
<p style="font-size: 14px; color: #6b7280; margin: 0;">${message}</p>
</div></body></html>`;
}

@Controller('csat')
export class CsatController {
  constructor(
    @Inject() private readonly csatRepository: TypeOrmCsatResponseRepository,
  ) {}

  @Public()
  @Get(':token/:rating')
  async respond(
    @Param('token') token: string,
    @Param('rating') rating: string,
    @Res() res: Response,
  ) {
    if (!VALID_RATINGS.includes(rating as CsatRating)) {
      return res.status(400).send('Invalid rating');
    }

    const csatResponse = await this.csatRepository.findByToken(token);
    if (!csatResponse) {
      return res.status(404).send('Survey not found');
    }

    if (csatResponse.rating) {
      return res.send(thankYouHtml(true, 'en'));
    }

    csatResponse.rating = rating as CsatRating;
    csatResponse.respondedAt = new Date();
    await this.csatRepository.update(csatResponse);

    return res.send(thankYouHtml(false, 'en'));
  }
}
