import QRCode from 'qrcode';
import type { RequestHandler } from './$types';

const MAX_URI = 2000;
const MARK_PATH =
  'M143.006 0C163.605 0 181.049 10.9956 186.975 26.1719C187.179 26.5 187.379 26.8309 187.572 27.167L226.962 95.959C235.454 105.253 249.043 111.274 264.362 111.274C282.089 111.274 297.502 103.211 305.377 91.3428L307.696 87.293C307.947 86.7768 308.185 86.2555 308.408 85.7285H308.591L344.49 23.0322C353.082 8.02827 373.149 0.840745 389.313 6.97852C405.476 13.1166 411.615 30.2557 403.024 45.2598L309.361 208.833C308.45 210.423 307.409 211.926 306.259 213.334C299.175 226.669 282.877 236 263.901 236C243.303 236 225.861 225.005 219.934 209.83C219.73 209.501 219.528 209.17 219.335 208.833L179.944 140.04C171.452 130.747 157.863 124.726 142.545 124.726C124.821 124.726 109.411 132.787 101.534 144.651L99.2102 148.71C98.9597 149.225 98.7215 149.745 98.4983 150.271H98.3166L62.4172 212.968C53.8257 227.972 33.7575 235.159 17.594 229.021C1.43079 222.883 -4.70725 205.744 3.884 190.74L97.5471 27.167C98.4581 25.5761 99.4989 24.0736 100.65 22.665C107.734 9.33121 124.031 0.00021985 143.006 0Z';
const MARK_VIEWBOX = '-4.707 0 407.731 236';
const MARK_ASPECT = 407.731 / 236;
const VIEWBOX = /viewBox="0 0 ([\d.]+) ([\d.]+)"/;

function mark(width: number, height: number): string {
  const dim = Math.min(width, height);
  const markWidth = dim * 0.34;
  const markHeight = markWidth / MARK_ASPECT;
  const box = dim * 0.4;
  const boxX = (width - box) / 2;
  const boxY = (height - box) / 2;
  const x = (width - markWidth) / 2;
  const y = (height - markHeight) / 2;
  const gradient =
    '<defs><linearGradient id="neo-mark" x1="264.033" y1="236" x2="263.588" y2="4.58152" gradientUnits="userSpaceOnUse"><stop stop-color="#C3DBE3"/><stop offset="1" stop-color="#626E97"/></linearGradient></defs>';
  return (
    `<rect x="${boxX}" y="${boxY}" width="${box}" height="${box}" rx="${dim * 0.06}" fill="#ffffff" shape-rendering="auto"/>` +
    `<svg x="${x}" y="${y}" width="${markWidth}" height="${markHeight}" viewBox="${MARK_VIEWBOX}" preserveAspectRatio="xMidYMid meet" shape-rendering="auto">${gradient}<path d="${MARK_PATH}" fill="url(#neo-mark)"/></svg>`
  );
}

function withMark(svg: string): string {
  const match = VIEWBOX.exec(svg);
  if (!match) return svg;
  return svg.replace('</svg>', `${mark(Number(match[1]), Number(match[2]))}</svg>`);
}

export const GET: RequestHandler = async ({ url }) => {
  const uri = url.searchParams.get('uri') ?? '';
  if (!uri || uri.length > MAX_URI) return new Response('', { status: 400 });

  const svg = await QRCode.toString(uri, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 240
  });

  return new Response(withMark(svg), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
};
