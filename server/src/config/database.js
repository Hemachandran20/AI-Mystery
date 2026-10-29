import mongoose from 'mongoose';

export class DatabaseConfigurationError extends Error {
  constructor() {
    super('MONGODB_URI is not configured on the server.');
    this.name = 'DatabaseConfigurationError';
    this.statusCode = 500;
  }
}

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new DatabaseConfigurationError();
  }

  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
