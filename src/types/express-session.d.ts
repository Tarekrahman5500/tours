import { Session } from 'express-session';
import { User } from '../user/entities'; // Import the session type from express-session

declare global {
  namespace Express {
    interface Request {
      session: Session; // Augment the Request interface to include session
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string; // Add userId as an optional property
    passport?: {
      user?: User;
    };
  }
}
