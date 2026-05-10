import React, { useState } from 'react';

export default function OfficialStickerImage({ sticker, className = '', fallbackClassName = '', alt }) {
  const [spriteFailed, setSpriteFailed] = useState(false);
  const label = alt || sticker?.name || sticker?.emotion || '官方表情包';
  const hasSprite = Boolean(sticker?.isSprite && sticker?.sheetUrl && !spriteFailed);

  if (!hasSprite) {
    return (
      <img
        src={sticker?.url}
        alt={label}
        loading="lazy"
        className={fallbackClassName || className}
        onError={event => {
          event.currentTarget.style.opacity = '0.25';
        }}
      />
    );
  }

  const rows = Number(sticker.rows || 1);
  const cols = Number(sticker.cols || 1);
  const row = Number(sticker.row || 0);
  const col = Number(sticker.col || 0);
  const backgroundSize = `${cols * 100}% ${rows * 100}%`;
  const backgroundPosition = `${cols <= 1 ? 0 : (col / (cols - 1)) * 100}% ${rows <= 1 ? 0 : (row / (rows - 1)) * 100}%`;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`bg-no-repeat bg-cover ${className}`}
      style={{
        backgroundImage: `url(${sticker.sheetUrl})`,
        backgroundSize,
        backgroundPosition,
      }}
    >
      <img
        src={sticker.sheetUrl}
        alt=""
        className="hidden"
        onError={() => setSpriteFailed(true)}
      />
    </div>
  );
}
