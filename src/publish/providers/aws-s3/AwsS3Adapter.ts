import {createHash, createHmac} from 'crypto'
import type {
    CredentialField,
    ExportedFile,
    PublishCredentials,
    PublishProgress,
    PublishResult,
    ValidationIssue,
    ValidationResult
} from '../../types/index'
import {PUBLISHER_EXTENSION_API_VERSION} from '../../types/index'
import type {PublisherExtension} from '../../types/PublisherExtension'
import {validateForAwsS3} from '../../validators/awsS3Validator'
import {makeError} from '../../validators/validationHelpers'

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

// ─── MIME type lookup ───────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
};

function getContentType(filePath: string): string {
    const ext = filePath.lastIndexOf('.') >= 0
        ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
        : '';
    return MIME_TYPES[ext] ?? 'application/octet-stream'
}

// ─── AWS Signature V4 helpers ───────────────────────────────────────────────

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data: string | Uint8Array): string {
    return createHash('sha256').update(data).digest('hex')
}

function getDateStrings(date: Date): { dateStamp: string; amzDate: string } {
    const iso = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return {
        dateStamp: iso.slice(0, 8),
        amzDate: iso
    }
}

function getSigningKey(
    secretKey: string,
    dateStamp: string,
    region: string
): Buffer {
    const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, SERVICE);
    return hmacSha256(kService, 'aws4_request')
}

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function uriEncodePath(path: string): string {
    return path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
}

function toBytes(content: string | Uint8Array): Uint8Array {
    if (content instanceof Uint8Array) return content;
    return new TextEncoder().encode(content)
}

function toArrayBuffer(content: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(content.byteLength);
    new Uint8Array(buffer).set(content);
    return buffer
}

interface SignedHeaders {
    [header: string]: string
}

function signRequest(
    method: string,
    bucketHost: string,
    objectKey: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    contentType: string,
    date: Date
): SignedHeaders {
    const {dateStamp, amzDate} = getDateStrings(date);
    const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
    const encodedKey = `/${uriEncodePath(objectKey)}`;

    const headers: Record<string, string> = {
        host: bucketHost,
        'x-amz-content-sha256': UNSIGNED_PAYLOAD,
        'x-amz-date': amzDate,
        'content-type': contentType
    };

    const sortedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = sortedHeaderKeys.join(';');
    const canonicalHeaders = sortedHeaderKeys
        .map((key) => `${key}:${headers[key]}\n`)
        .join('');

    const canonicalRequest = [
        method,
        encodedKey,
        '',
        canonicalHeaders,
        signedHeaders,
        UNSIGNED_PAYLOAD
    ].join('\n');

    const stringToSign = [
        ALGORITHM,
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join('\n');

    const signingKey = getSigningKey(secretAccessKey, dateStamp, region);
    const signature = hmacSha256(signingKey, stringToSign).toString('hex');

    const authorization =
        `${ALGORITHM} Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        Authorization: authorization,
        'x-amz-content-sha256': UNSIGNED_PAYLOAD,
        'x-amz-date': amzDate,
        'Content-Type': contentType
    }
}

// ─── Adapter ────────────────────────────────────────────────────────────────

function credentialIssue(label: string): ValidationIssue {
    return makeError(`${label} is required to publish to AWS S3.`)
}

export class AwsS3Adapter implements PublisherExtension {
    readonly apiVersion = PUBLISHER_EXTENSION_API_VERSION;

    readonly meta = {
        id: 'aws-s3',
        displayName: 'AWS S3',
        websiteUrl: 'https://aws.amazon.com/s3',
        description: 'Static site hosting on Amazon S3 with global availability'
    };

    readonly credentialFields: CredentialField[] = [
        {
            key: 'accessKeyId',
            label: 'Access Key ID',
            placeholder: 'AKIA...',
            sensitive: false
        },
        {
            key: 'secretAccessKey',
            label: 'Secret Access Key',
            sensitive: true
        },
        {
            key: 'bucket',
            label: 'Bucket Name',
            placeholder: 'my-website-bucket',
            sensitive: false
        },
        {
            key: 'region',
            label: 'Region',
            placeholder: 'us-east-1',
            sensitive: false
        },
        {
            key: 'customDomain',
            label: 'Custom Domain (optional)',
            placeholder: 'www.example.com',
            sensitive: false
        }
    ];

    async validate(
        files: ExportedFile[],
        credentials: PublishCredentials
    ): Promise<ValidationResult> {
        const baseResult = validateForAwsS3(files);
        const issues: ValidationIssue[] = [...baseResult.issues];

        if (!credentials.accessKeyId?.trim()) {
            issues.push(credentialIssue('Access Key ID'))
        }
        if (!credentials.secretAccessKey?.trim()) {
            issues.push(credentialIssue('Secret Access Key'))
        }
        if (!credentials.bucket?.trim()) {
            issues.push(credentialIssue('Bucket Name'))
        }
        if (!credentials.region?.trim()) {
            issues.push(credentialIssue('Region'))
        }

        const ok = issues.every((issue) => issue.severity !== 'error');
        return {ok, issues}
    }

    async publish(
        files: ExportedFile[],
        credentials: PublishCredentials,
        onProgress: (progress: PublishProgress) => void
    ): Promise<PublishResult> {
        onProgress({
            phase: 'validating',
            percent: 0,
            message: 'Validating files...'
        });

        const validation = await this.validate(files, credentials);
        if (!validation.ok) {
            return {
                success: false,
                error: 'Validation failed',
                warnings: validation.issues
            }
        }

        const accessKeyId = credentials.accessKeyId.trim();
        const secretAccessKey = credentials.secretAccessKey.trim();
        const bucket = credentials.bucket.trim();
        const region = credentials.region.trim();
        const bucketHost = `${bucket}.s3.${region}.amazonaws.com`;

        onProgress({
            phase: 'uploading',
            percent: 5,
            message: 'Uploading files to S3...'
        });

        const totalFiles = files.length;
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const objectKey = normalizePath(file.path);
            const contentType = getContentType(objectKey);
            const body = toBytes(file.content);

            const headers = signRequest(
                'PUT',
                bucketHost,
                objectKey,
                region,
                accessKeyId,
                secretAccessKey,
                contentType,
                new Date()
            );

            const response = await fetch(`https://${bucketHost}/${uriEncodePath(objectKey)}`, {
                method: 'PUT',
                headers,
                body: toArrayBuffer(body)
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                return {
                    success: false,
                    error: `Failed to upload ${objectKey}: ${errorText}`,
                    warnings: validation.issues
                }
            }

            const percent = Math.min(95, Math.round(((i + 1) / totalFiles) * 90) + 5);
            onProgress({
                phase: 'uploading',
                percent,
                message: `Uploaded ${i + 1} of ${totalFiles} files...`
            })
        }

        onProgress({phase: 'done', percent: 100, message: 'Published!'});

        const customDomain = credentials.customDomain?.trim();
        const siteUrl = customDomain
            ? `https://${customDomain}`
            : `http://${bucket}.s3-website.${region}.amazonaws.com`;

        return {
            success: true,
            url: siteUrl,
            warnings: validation.issues
        }
    }
}
