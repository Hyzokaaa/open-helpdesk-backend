import { Controller, Get, Header, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Public } from '../../../nest/decorators/public.decorator';

@Public()
@Controller()
export class WidgetController {
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @Get('widget.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @Header('Access-Control-Allow-Origin', '*')
  serveWidget(@Res() res: Response) {
    const script = WIDGET_SDK.replace('__FRONTEND_URL__', this.frontendUrl);
    res.send(script);
  }
}

const WIDGET_SDK = `(function(){
  var script = document.currentScript || document.querySelector('script[data-workspace]');
  if (!script) return;
  var slug = script.getAttribute('data-workspace');
  if (!slug) return;

  var FRONTEND_URL = '__FRONTEND_URL__';
  var iframeUrl = FRONTEND_URL + '/portal/' + slug + '?mode=widget';

  // Prevent double-init
  if (window.$openHelpdesk) return;

  // --- Styles ---
  var style = document.createElement('style');
  style.textContent = [
    '.ohd-bubble{position:fixed!important;bottom:20px!important;right:20px!important;width:56px!important;height:56px!important;border-radius:50%!important;background:#10b981!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;z-index:2147483647!important;box-shadow:0 4px 12px rgba(0,0,0,0.15)!important;transition:transform 0.15s ease!important;border:none!important;outline:none!important;padding:0!important;}',
    '.ohd-bubble:hover{transform:scale(1.1)!important;}',
    '.ohd-bubble svg{width:28px!important;height:28px!important;fill:none!important;stroke:#fff!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important;}',
    '.ohd-container{position:fixed!important;bottom:88px!important;right:20px!important;width:400px!important;height:600px!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 8px 32px rgba(0,0,0,0.15)!important;z-index:2147483646!important;background:#fff!important;}',
    '.ohd-iframe{width:100%!important;height:100%!important;border:none!important;display:block!important;}',
    '.ohd-hidden{display:none!important;}',
    '@media(max-width:667px){',
    '  .ohd-container{top:0!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;border-radius:0!important;}',
    '  .ohd-bubble-hidden{display:none!important;}',
    '}',
  ].join('\\n');
  document.head.appendChild(style);

  // --- Bubble ---
  var bubble = document.createElement('button');
  bubble.className = 'ohd-bubble';
  bubble.setAttribute('aria-label', 'Open support');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  // --- Container + iframe ---
  var container = document.createElement('div');
  container.className = 'ohd-container ohd-hidden';

  var iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.className = 'ohd-iframe';
  iframe.allow = 'clipboard-write';
  iframe.setAttribute('title', 'Support widget');
  container.appendChild(iframe);

  // --- State ---
  var isOpen = false;
  var isMobile = window.innerWidth <= 667;

  window.addEventListener('resize', function() {
    isMobile = window.innerWidth <= 667;
    if (isOpen && isMobile) {
      bubble.classList.add('ohd-bubble-hidden');
    } else {
      bubble.classList.remove('ohd-bubble-hidden');
    }
  });

  function open() {
    isOpen = true;
    container.classList.remove('ohd-hidden');
    if (isMobile) bubble.classList.add('ohd-bubble-hidden');
  }

  function close() {
    isOpen = false;
    container.classList.add('ohd-hidden');
    bubble.classList.remove('ohd-bubble-hidden');
  }

  function toggle() {
    if (isOpen) close(); else open();
  }

  bubble.onclick = toggle;

  // --- postMessage listener ---
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'string') return;
    if (e.data === 'ohd:close') close();
  });

  // --- Mount ---
  document.body.appendChild(container);
  document.body.appendChild(bubble);

  // --- Public API ---
  window.$openHelpdesk = {
    open: open,
    close: close,
    toggle: toggle,
  };
})();`;
