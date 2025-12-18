// script_postres.js
document.addEventListener("DOMContentLoaded", () => {

  // Inject minimal modal styles so no CSS change es necesario
  const style = document.createElement("style");
  style.textContent = `
    .rc-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    }
    .rc-modal {
      width: 90%;
      max-width: 720px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      overflow: hidden;
      font-family: inherit;
    }
    .rc-modal-header {
      display:flex; justify-content: space-between; align-items:center;
      padding: 12px 16px; border-bottom: 1px solid #eee;
    }
    .rc-modal-title { font-weight:700; font-size:1.1rem; color:#222; }
    .rc-modal-body { padding: 16px; display: grid; grid-template-columns: 1fr; gap:12px; }
    .rc-modal-body img { width:100%; height: auto; object-fit: cover; border-radius:8px; }
    .rc-modal-actions { display:flex; gap:8px; justify-content:flex-end; padding:12px 16px; border-top:1px solid #eee; }
    .rc-btn { padding:8px 12px; border-radius:8px; border: none; cursor:pointer; font-weight:600; }
    .rc-btn-primary { background: #ff4b78; color: white; }
    .rc-btn-ghost { background: transparent; border:1px solid #ddd; }
    .btn-favorito.activo { background-color: #ff4b78 !important; color: #fff !important; transform: scale(1.06); }
    `;
  document.head.appendChild(style);

  // Crear modal (se reutiliza)
  let modalBackdrop = null;
  function openModal({ title = "", imageSrc = "", videoUrl = null, fallbackText = "" } = {}) {
    // Si ya existe, removerla
    if (modalBackdrop) modalBackdrop.remove();

    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "rc-modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="rc-modal" role="dialog" aria-modal="true" aria-label="Reproductor de receta">
        <div class="rc-modal-header">
          <div class="rc-modal-title">${escapeHtml(title)}</div>
          <button class="rc-close" aria-label="Cerrar" title="Cerrar">&times;</button>
        </div>
        <div class="rc-modal-body">
          ${ imageSrc ? `<img src="${escapeAttr(imageSrc)}" alt="${escapeAttr(title)}">` : "" }
          <div class="rc-modal-text">
            ${ videoUrl ? `<p>Se encontró un video para esta receta. Pulsa "Abrir video" para verlo.</p>` : `<p>${escapeHtml(fallbackText || "No hay video asociado para esta receta.")}</p>` }
          </div>
        </div>
        <div class="rc-modal-actions">
          <button class="rc-btn rc-btn-ghost rc-close">Cerrar</button>
          ${ videoUrl ? `<button class="rc-btn rc-btn-primary rc-open-video">Abrir video</button>` : "" }
        </div>
      </div>
    `;

    // Cerrar al click en backdrop (fuera del modal) o en botones con clase rc-close
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
      if (e.target.classList.contains("rc-close")) closeModal();
    });

    // abrir video
    const openVideoHandler = (e) => {
      if (!videoUrl) return;
      // abrir en nueva pestaña
      window.open(videoUrl, "_blank", "noopener");
    };

    // Delegacion para boton abrir video
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target.classList.contains("rc-open-video")) openVideoHandler();
    });

    // cerrar con Escape
    const escListener = (e) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", escListener);

    function closeModal() {
      if (modalBackdrop) modalBackdrop.remove();
      modalBackdrop = null;
      document.removeEventListener("keydown", escListener);
    }

    document.body.appendChild(modalBackdrop);
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.remove();
    modalBackdrop = null;
  }

  // Escape sanitize helpers
  function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  }
  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, "&quot;");
  }

  // Recorremos cada tarjeta
  const tarjetas = document.querySelectorAll(".tarjeta-receta");
  tarjetas.forEach((tarjeta) => {
    // obtener titulo (clave estable)
    const tituloEl = tarjeta.querySelector("h3");
    const titulo = tituloEl ? tituloEl.textContent.trim() : "receta";
    // crear slug simple
    const slug = titulo.toLowerCase().replace(/\s+/g, "_").replace(/[^\w\-]/g, "");

    // buscar botones dentro de la tarjeta
    const btnFavorito = tarjeta.querySelector(".btn-favorito");
    const btnPlay = tarjeta.querySelector(".btn-play");
    const img = tarjeta.querySelector("img");
    // posible atributo data-video en la tarjeta (puedes añadirlo si quieres): <div class="tarjeta-receta" data-video="https://www.youtube.com/watch?v=...">
    const videoUrl = tarjeta.getAttribute("data-video"); // null si no existe

    // Inicializar estado favorito desde localStorage
    const key = `favorito_${slug}`;
    const saved = localStorage.getItem(key);
    if (btnFavorito) {
      if (saved === "true") {
        btnFavorito.classList.add("activo");
        btnFavorito.textContent = "💖";
        btnFavorito.setAttribute("aria-pressed", "true");
      } else {
        btnFavorito.classList.remove("activo");
        btnFavorito.textContent = "❤️";
        btnFavorito.setAttribute("aria-pressed", "false");
      }

      // click favorite
      btnFavorito.addEventListener("click", (e) => {
        e.stopPropagation();
        const isActive = btnFavorito.classList.toggle("activo");
        if (isActive) {
          btnFavorito.textContent = "💖";
          btnFavorito.setAttribute("aria-pressed", "true");
          localStorage.setItem(key, "true");
        } else {
          btnFavorito.textContent = "❤️";
          btnFavorito.setAttribute("aria-pressed", "false");
          localStorage.setItem(key, "false");
        }
      });
    }

    // click play: abrir modal con image + opcion de video
    if (btnPlay) {
      btnPlay.addEventListener("click", (e) => {
        e.stopPropagation();
        const imageSrc = img ? img.src.replace("AQUI VA LA IMAGEN","") : "";
        const fallbackText = `Receta: ${titulo}. Puedes añadir un video a la tarjeta con el atributo HTML data-video. Ejemplo: <div class="tarjeta-receta" data-video="https://www.youtube.com/watch?v=...">`;
        openModal({
          title: titulo,
          imageSrc: imageSrc || "",
          videoUrl: videoUrl || null,
          fallbackText
        });
      });
    }

    // mejora accesibilidad: enter/space en botones
    [btnFavorito, btnPlay].forEach((b) => {
      if (!b) return;
      b.setAttribute("tabindex", "0");
      b.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") b.click();
      });
    });
  });

  // ---- Opcional: detectar tarjetas nuevas añadidas dinámicamente ----
  // si tu aplicación añade tarjetas después, este observer puede inicializarlas.
  // (puedes comentar si no lo necesitas)
  const observer = new MutationObserver((mutations) => {
    // simple: si aparecen .tarjeta-receta nuevas reiniciamos listeners
    const added = mutations.some(m => Array.from(m.addedNodes || []).some(n => n instanceof Element && n.matches && n.matches(".tarjeta-receta")));
    if (added) {
      // desconectar para no recursividad
      observer.disconnect();
      // re-run initialization
      document.querySelectorAll(".tarjeta-receta").forEach(t => {
        // only attach if not already processed (we use a data attribute)
        if (!t.dataset.rcInit) {
          t.dataset.rcInit = "1";
        }
      });
      // recargar la página para simplificar (o podrías reinicializar manualmente)
      // location.reload();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

});