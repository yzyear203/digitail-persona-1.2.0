import React, { useRef, useState } from 'react';
import { ImagePlus, Moon, Palette, Sun, Trash2, Upload, UserCircle, X } from 'lucide-react';
import { db } from '../../lib/cloudbase';

const AVATAR_SIZE = 180;
const BACKGROUND_SIZE = 1600;

function compressImageFile(file, maxSize, quality = 0.76) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = event => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function AvatarPreview({ src, label, fallbackClass = 'bg-slate-100 text-slate-400' }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 ${fallbackClass}`}>
        {src ? <img src={src} alt={label} className="w-full h-full object-cover" /> : <UserCircle size={28} />}
      </div>
      <div>
        <p className="text-sm font-black text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 font-bold">建议使用正方形图片，系统会自动压缩</p>
      </div>
    </div>
  );
}

export default function ChatAppearanceModal({
  activePersona,
  setActivePersona,
  chatAppearance,
  setChatAppearance,
  showMsg,
  onClose,
}) {
  const personaAvatarInputRef = useRef(null);
  const userAvatarInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDark = chatAppearance.theme === 'dark';

  const updateAppearance = patch => {
    setChatAppearance(prev => ({ ...prev, ...patch }));
  };

  const handlePersonaAvatarChange = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsSaving(true);
    try {
      const avatarUrl = await compressImageFile(file, AVATAR_SIZE, 0.78);
      setActivePersona(prev => ({ ...prev, avatarUrl }));
      if (db && activePersona?.id) {
        await db.collection('personas').doc(activePersona.id).update({ avatarUrl });
      }
      showMsg('✅ Persona 头像已更新');
    } catch (error) {
      showMsg('❌ 头像保存失败: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserAvatarChange = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const userAvatar = await compressImageFile(file, AVATAR_SIZE, 0.78);
      updateAppearance({ userAvatar });
      showMsg('✅ 我方头像已更新');
    } catch (error) {
      showMsg('❌ 头像读取失败: ' + error.message);
    }
  };

  const handleBackgroundChange = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backgroundImage = await compressImageFile(file, BACKGROUND_SIZE, 0.68);
      updateAppearance({ backgroundImage });
      showMsg('✅ 聊天背景已更新');
    } catch (error) {
      showMsg('❌ 背景读取失败: ' + error.message);
    }
  };

  const clearPersonaAvatar = async () => {
    setIsSaving(true);
    try {
      setActivePersona(prev => ({ ...prev, avatarUrl: '' }));
      if (db && activePersona?.id) {
        await db.collection('personas').doc(activePersona.id).update({ avatarUrl: '' });
      }
      showMsg('✅ Persona 头像已清除');
    } catch (error) {
      showMsg('❌ 清除失败: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Palette className="text-emerald-600" /> 聊天外观
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-slate-50/70">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">主题模式</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateAppearance({ theme: 'light' })}
                className={`rounded-2xl border p-4 flex items-center gap-3 font-black transition-all ${!isDark ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
              >
                <Sun size={20} /> 浅色模式
              </button>
              <button
                type="button"
                onClick={() => updateAppearance({ theme: 'dark' })}
                className={`rounded-2xl border p-4 flex items-center gap-3 font-black transition-all ${isDark ? 'border-emerald-400 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
              >
                <Moon size={20} /> 深色模式
              </button>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <AvatarPreview src={activePersona?.avatarUrl} label="Persona 头像" fallbackClass="bg-indigo-50 text-indigo-500" />
            <div className="flex flex-wrap gap-3">
              <button disabled={isSaving} onClick={() => personaAvatarInputRef.current?.click()} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                <Upload size={16} /> 上传 Persona 头像
              </button>
              <button disabled={isSaving || !activePersona?.avatarUrl} onClick={clearPersonaAvatar} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-200 disabled:opacity-40 flex items-center gap-2">
                <Trash2 size={16} /> 清除
              </button>
            </div>
            <input ref={personaAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handlePersonaAvatarChange} />
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <AvatarPreview src={chatAppearance.userAvatar} label="我方头像" fallbackClass="bg-emerald-50 text-emerald-500" />
            <div className="flex flex-wrap gap-3">
              <button onClick={() => userAvatarInputRef.current?.click()} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 flex items-center gap-2">
                <Upload size={16} /> 上传我方头像
              </button>
              <button disabled={!chatAppearance.userAvatar} onClick={() => updateAppearance({ userAvatar: '' })} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-200 disabled:opacity-40 flex items-center gap-2">
                <Trash2 size={16} /> 清除
              </button>
            </div>
            <input ref={userAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleUserAvatarChange} />
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">聊天背景图</h3>
              <p className="text-xs text-slate-400 font-bold">背景图只保存在本机浏览器，不会写入 Persona 云端档案。</p>
            </div>
            <div className="h-32 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
              {chatAppearance.backgroundImage ? (
                <img src={chatAppearance.backgroundImage} alt="聊天背景预览" className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-400 font-black flex items-center gap-2"><ImagePlus size={20} /> 暂无自定义背景</div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => backgroundInputRef.current?.click()} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl font-black text-sm hover:bg-slate-700 flex items-center gap-2">
                <ImagePlus size={16} /> 选择背景图
              </button>
              <button disabled={!chatAppearance.backgroundImage} onClick={() => updateAppearance({ backgroundImage: '' })} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-200 disabled:opacity-40 flex items-center gap-2">
                <Trash2 size={16} /> 清除背景
              </button>
            </div>
            <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundChange} />
          </section>
        </div>
      </div>
    </div>
  );
}
