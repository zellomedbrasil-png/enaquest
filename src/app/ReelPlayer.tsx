"use client";

import { useRef } from "react";
import s from "./landing.module.css";

export function ReelPlayer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  function open() {
    dialog.current?.showModal();
    void video.current?.play().catch(() => {});
  }

  return <>
    <button type="button" className={s.reelButton} onClick={open}>
      <span aria-hidden="true">▶</span> Assistir ao reel
    </button>
    <dialog ref={dialog} className={s.dialog} aria-label="Reel de apresentação do EnaQuest"
      onClose={() => video.current?.pause()}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={s.player}>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar vídeo">×</button>
        <video ref={video} controls playsInline preload="none" poster="/campanha/reel-capa.webp" aria-label="Do Plantão do Dia à revisão, em 18 segundos">
          <source src="/campanha/enaquest.mp4" type="video/mp4" />
        </video>
      </div>
    </dialog>
  </>;
}
