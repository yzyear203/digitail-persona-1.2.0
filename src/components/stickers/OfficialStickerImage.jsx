import React, { useMemo, useState } from 'react';

function getSheetUrlCandidates(sheetUrl) {
  if (Array.isArray(sheetUrl)) return sheetUrl.filter(Boolean);
  return sheetUrl ? [sheetUrl] : [];
}

export default function OfficialStickerImage({ sticker, className = '', fallbackClassName = '', alt }) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [spriteFailed, setSpriteFailed] = useState(false);
  const label = alt || sticker?.name || sticker?.emotion || '官方表情包';
  const sheetUrlCandidates = useMemo(() => getSheetUrlCandidates(sticker?.sheetUrl), [sticker?.sheetUrl]);
  const currentSheetUrl = sheetUrlCandidates[candidateIndex] || '';
  const hasSprite = Boolean(sticker?.isSprite && currentSheetUrl && !spriteFailed);

  const handleSpriteError = () => {
    if (candidateIndex < sheetUrlCandidates.length - 1) {
      setCandidateIndex(index => index + 1);
      return;
    }
    setSpriteFailed(true);
  };

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
        backgroundImage: `url(${currentSheetUrl})`,
        backgroundSize,
        backgroundPosition,
      }}
    >
      <img
        src={currentSheetUrl}
        alt=""
        className="hidden"
        onError={handleSpriteError}
      />
    </div>
  );
}
