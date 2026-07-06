import type { HttpPort, HttpRequestOptions, HttpResponsePort } from '../../ports/HttpPort';

export class FetchHttpAdapter implements HttpPort {
  request(url: string, options?: HttpRequestOptions): Promise<HttpResponsePort> {
    return fetch(url, options);
  }
}

