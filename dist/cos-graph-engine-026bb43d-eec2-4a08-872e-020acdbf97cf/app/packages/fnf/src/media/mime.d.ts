import type { UploadType } from './types';
export declare function inferUploadType(contentType: string): UploadType;
export declare function inferContentType(filename: string | undefined, contentType: string | undefined): string;
export declare function defaultFilenameForContentType(contentType: string, type: UploadType): string;
//# sourceMappingURL=mime.d.ts.map