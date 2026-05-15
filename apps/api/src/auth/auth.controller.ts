import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const user = await this.auth.authenticate(authorization);
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }
}
