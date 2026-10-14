/** API error with the spec's status codes: 400 bad field, 409 locked/duplicate, 422 incomplete, 451 consent. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'bad_request', message, details);
export const notFound = (what = 'Not found') => new HttpError(404, 'not_found', what);
