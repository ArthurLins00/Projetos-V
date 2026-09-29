import path from 'path';

// Fotos das ocorrências ficam em backend/uploads e são servidas em /uploads
export const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
export const UPLOADS_ROUTE = '/uploads';
export const PHOTO_BODY_LIMIT = '15mb';
