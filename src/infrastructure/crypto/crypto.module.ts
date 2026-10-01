import { Global, Module } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { AesGcmSecretCipher } from '@infrastructure/crypto/aes-gcm-secret-cipher';

@Global()
@Module({
  providers: [
    {
      provide: SecretCipherPort,
      useFactory: () => new AesGcmSecretCipher(process.env.APP_ENCRYPTION_KEY),
    },
  ],
  exports: [SecretCipherPort],
})
export class CryptoModule {}
