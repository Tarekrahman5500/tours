import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { MulterError } from 'multer';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    const errors: any[] = [];

    // Specific exception handling
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      status = HttpStatus.BAD_REQUEST;
      message = zodError.message;
      errors.push(zodError.issues); // Add Zod issues to errors array
    } else if (exception instanceof MulterError) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object') {
        message = (responseBody as any).message || message;
        errors.push((responseBody as any).errors || []);
      }
    } else if (exception instanceof Error) {
      // General error handling
      message = exception.message;
    }

    // Log the exception
    console.error({
      status,
      message,
      stack: exception instanceof Error ? exception.stack : null,
    });

    // Send response
    response.status(status).json({
      statusCode: status,
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      errors,
    });
  }
}
