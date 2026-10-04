import { registerDecorator, ValidationOptions } from 'class-validator';
import { isPasswordAcceptable, PASSWORD_POLICY_MESSAGE } from '../../../domain/password-policy';

/** Request-level mirror of the domain password policy, so a weak password fails with a 400 early. */
export function IsAcceptablePassword(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isAcceptablePassword',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: PASSWORD_POLICY_MESSAGE, ...options },
      validator: {
        validate: (value: unknown) => isPasswordAcceptable(value),
      },
    });
  };
}
