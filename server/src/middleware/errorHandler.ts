import { Request, Response, NextFunction } from 'express';
import { AppError, ConflictError } from '../utils/errors';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    currentState?: unknown;
  };
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err);

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err.details !== undefined) {
      response.error.details = err.details;
    }

    if (err instanceof ConflictError && err.currentState !== undefined) {
      response.error.currentState = err.currentState;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err,
      },
    });
  }

  // Unknown error
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}