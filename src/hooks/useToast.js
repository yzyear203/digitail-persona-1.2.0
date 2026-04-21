import { useState } from 'react';

export function useToast() {
  const [sysMessage, setSysMessage] = useState('');

  const showMsg = (msg) => {
    setSysMessage(msg);
    setTimeout(() => setSysMessage(''), 4500);
  };

  const clearMsg = () => setSysMessage('');

  return { sysMessage, showMsg, clearMsg };
}