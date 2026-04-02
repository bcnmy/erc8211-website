import type { APIRoute } from 'astro';
import satori from 'satori';
import sharp from 'sharp';

async function fetchFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(url, {
    headers: { 'User-Agent': '' },
  });
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/);
  if (!match?.[1]) throw new Error(`Could not extract font URL for ${family} ${weight}`);
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

export const GET: APIRoute = async () => {
  const [interSemiBold, sourceSerif700] = await Promise.all([
    fetchFont('Inter', 600),
    fetchFont('Source Serif 4', 700),
  ]);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#fafaf9',
          padding: '72px 80px',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', gap: '12px', marginBottom: '40px' },
              children: [
                label('ERC-8211'),
                label('Standards Track'),
                label('Draft'),
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'Source Serif 4',
                fontSize: '72px',
                fontWeight: 700,
                color: '#111111',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                marginBottom: '24px',
                maxWidth: '900px',
              },
              children: 'ERC-8211: Smart Batching',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'Source Serif 4',
                fontSize: '32px',
                fontWeight: 700,
                color: '#717171',
                fontStyle: 'italic',
                marginBottom: '48px',
              },
              children: 'From transactions to programs.',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                marginTop: 'auto',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: '18px',
                      color: '#8a8a8a',
                    },
                    children:
                      'A smart account batch encoding resolved at execution time from on-chain state.',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: '#2563eb',
                          },
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#555555',
                          },
                          children: 'ethereum',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interSemiBold, weight: 600, style: 'normal' },
        { name: 'Source Serif 4', data: sourceSerif700, weight: 700, style: 'normal' },
      ],
    },
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

function label(text: string) {
  return {
    type: 'div' as const,
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: '6px',
        fontSize: '16px',
        fontWeight: 600,
        color: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.06)',
        letterSpacing: '0.02em',
      },
      children: text,
    },
  };
}
