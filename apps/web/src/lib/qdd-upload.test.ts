import { describe, expect, it } from 'vitest';
import { readQddFormData } from './qdd-upload';

describe('readQddFormData', () => {
  it('aceita um formulário multipart dentro do limite', async () => {
    const form = new FormData();
    form.set('year', '2026');
    form.set('file', new File(['qdd'], 'qdd.xls'));
    const request = new Request('http://localhost/api/imports/qdd/preview', {
      method: 'POST',
      body: form,
    });
    const result = await readQddFormData(request);
    expect(result.response).toBeUndefined();
    expect(result.formData?.get('year')).toBe('2026');
    expect((result.formData?.get('file') as File).name).toBe('qdd.xls');
  });

  it('recusa corpo maior que o limite mesmo sem Content-Length', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64));
      },
    });
    const request = new Request('http://localhost/api/imports/qdd/preview', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const result = await readQddFormData(request, 32);
    expect(result.response?.status).toBe(413);
  });

  it('recusa Content-Length excessivo antes de ler o corpo', async () => {
    const request = new Request('http://localhost/api/imports/qdd/preview', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=test',
        'content-length': '999',
      },
      body: '--test--',
    });
    const result = await readQddFormData(request, 32);
    expect(result.response?.status).toBe(413);
  });
});
