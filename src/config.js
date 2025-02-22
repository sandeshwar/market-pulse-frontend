export const config = {
  API_URL: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/'
    : 'https://luminera.ai:3000/api/',
  API_KEY: 'VG1hV1pNclRSeUYtZ2N1S2kyeXhvanBKbloyUTVtVGl6a2VjemNpazFyYz0'
};