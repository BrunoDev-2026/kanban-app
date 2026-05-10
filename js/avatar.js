/**
 * MB FLOWBOARD — js/avatar.js
 * Perfil local do usuário
 * Iniciais · Cor personalizada · Upload & Recorte (LinkedIn Style)
 */

'use strict';

/** Estado interno do editor de recorte */
let cropState = {
  img: null,
  scale: 1,
  x: 0,
  y: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  originalWidth: 0,
  originalHeight: 0,
  viewportSize: 280,
  appState: null,
  // Handlers nomeados para remoção limpa
  handleMouseMove: null,
  handleMouseUp: null,
  handleTouchMove: null,
  handleTouchEnd: null
};

/**
 * Extrai as iniciais do nome do usuário
 */
function getInitials(name) {
  if (!name) return '??';
  return name
    .trim()
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Atualiza o avatar em todos os locais necessários
 */
function updateAvatarDisplay(profile) {
  const headerAvatar = document.getElementById('headerAvatar');
  const previewAvatar = document.getElementById('profilePhotoPreview');

  [headerAvatar, previewAvatar].forEach(el => {
    if (!el) return;
    if (profile.photo) {
      el.style.backgroundImage = `url(${profile.photo})`;
      el.textContent = '';
      el.style.backgroundColor = 'transparent';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      el.style.backgroundImage = 'none';
      el.textContent = getInitials(profile.name);
      el.style.backgroundColor = profile.color || '#6C63FF';
    }
  });
}

/**
 * Inicializa o modal de perfil
 */
function openProfileModal(appState) {
  const nameInput  = document.getElementById('userNameInput');
  const focusInput = document.getElementById('focusTimeInput');
  const breakInput = document.getElementById('breakTimeInput');
  const picker     = document.getElementById('avatarColorPicker');
  const photoInput = document.getElementById('userPhotoInput');
  const removeBtn  = document.getElementById('removePhotoBtn');

  cropState.appState = appState;

  if (nameInput)  nameInput.value  = appState.profile.name      || '';
  if (focusInput) focusInput.value = appState.profile.focusTime  || 25;
  if (breakInput) breakInput.value = appState.profile.breakTime  || 5;
  
  if (photoInput) photoInput.value = '';
  if (removeBtn) removeBtn.style.display = appState.profile.photo ? 'block' : 'none';

  updateAvatarDisplay(appState.profile);

  const avatarColors = ['#6C63FF', '#FF6584', '#43D9AD', '#FFB347', '#4FC3F7', '#BA68C8', '#F06292', '#FF8A65'];
  if (picker) {
    picker.innerHTML = '';
    avatarColors.forEach(color => {
      const dot = document.createElement('button');
      dot.className = `color-dot ${appState.profile.color === color ? 'selected' : ''}`;
      dot.style.background = color;
      dot.onclick = () => {
        appState.profile.color = color;
        picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
        updateAvatarDisplay(appState.profile);
      };
      picker.appendChild(dot);
    });
  }

  if (photoInput) {
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        if (typeof showToast === 'function') showToast('🚫 Formato inválido. Use JPG, PNG ou WEBP.');
        photoInput.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('🚫 Arquivo muito grande (máx 5MB).');
        photoInput.value = '';
        return;
      }

      initCropEditor(file);
    };
  }

  if (removeBtn) {
    removeBtn.onclick = () => {
      appState.profile.photo = null;
      removeBtn.style.display = 'none';
      updateAvatarDisplay(appState.profile);
      if (typeof saveState === 'function') saveState(appState);
      if (typeof showToast === 'function') showToast('🗑️ Foto removida.');
    };
  }

  openModal('profileModal');
}

/**
 * Inicializa o Editor de Recorte
 */
function initCropEditor(file) {
  const overlay = document.getElementById('cropEditorOverlay');
  const cropImg = document.getElementById('cropImage');
  const zoomRange = document.getElementById('zoomRange');
  const viewport = document.getElementById('cropViewport');
  const reader = new FileReader();

  reader.onload = (e) => {
    cropImg.src = e.target.result;
    cropImg.onload = () => {
      overlay.classList.add('open');
      
      const aspect = cropImg.naturalWidth / cropImg.naturalHeight;
      if (aspect > 1) { 
        cropState.originalHeight = cropState.viewportSize;
        cropState.originalWidth = cropState.viewportSize * aspect;
      } else { 
        cropState.originalWidth = cropState.viewportSize;
        cropState.originalHeight = cropState.viewportSize / aspect;
      }

      cropState.scale = 1;
      cropState.x = (cropState.viewportSize - cropState.originalWidth) / 2;
      cropState.y = (cropState.viewportSize - cropState.originalHeight) / 2;
      
      zoomRange.value = 1;
      updateCropTransform();
    };
  };
  reader.readAsDataURL(file);

  const startDrag = (e) => {
    if (cropState.isDragging) return;
    cropState.isDragging = true;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    cropState.startX = clientX - cropState.x;
    cropState.startY = clientY - cropState.y;
    viewport.style.cursor = 'grabbing';
    
    // Handlers para remoção segura
    cropState.handleMouseMove = (ev) => doDrag(ev);
    cropState.handleMouseUp = () => endDrag();
    cropState.handleTouchMove = (ev) => doDrag(ev);
    cropState.handleTouchEnd = () => endDrag();

    window.addEventListener('mousemove', cropState.handleMouseMove);
    window.addEventListener('mouseup', cropState.handleMouseUp);
    window.addEventListener('touchmove', cropState.handleTouchMove, { passive: false });
    window.addEventListener('touchend', cropState.handleTouchEnd);
  };

  const doDrag = (e) => {
    if (!cropState.isDragging) return;
    if (e.cancelable) e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let newX = clientX - cropState.startX;
    let newY = clientY - cropState.startY;

    const scaledWidth = cropState.originalWidth * cropState.scale;
    const scaledHeight = cropState.originalHeight * cropState.scale;

    newX = Math.min(0, Math.max(newX, cropState.viewportSize - scaledWidth));
    newY = Math.min(0, Math.max(newY, cropState.viewportSize - scaledHeight));

    cropState.x = newX;
    cropState.y = newY;
    updateCropTransform();
  };

  const endDrag = () => {
    if (!cropState.isDragging) return;
    cropState.isDragging = false;
    viewport.style.cursor = 'move';
    
    window.removeEventListener('mousemove', cropState.handleMouseMove);
    window.removeEventListener('mouseup', cropState.handleMouseUp);
    window.removeEventListener('touchmove', cropState.handleTouchMove);
    window.removeEventListener('touchend', cropState.handleTouchEnd);
  };

  viewport.onmousedown = startDrag;
  viewport.ontouchstart = startDrag;

  zoomRange.oninput = (e) => {
    const oldScale = cropState.scale;
    cropState.scale = parseFloat(e.target.value);
    
    const center = cropState.viewportSize / 2;
    cropState.x = center - (center - cropState.x) * (cropState.scale / oldScale);
    cropState.y = center - (center - cropState.y) * (cropState.scale / oldScale);

    const scaledWidth = cropState.originalWidth * cropState.scale;
    const scaledHeight = cropState.originalHeight * cropState.scale;
    
    cropState.x = Math.min(0, Math.max(cropState.x, cropState.viewportSize - scaledWidth));
    cropState.y = Math.min(0, Math.max(cropState.y, cropState.viewportSize - scaledHeight));

    updateCropTransform();
  };

  document.getElementById('cancelCropBtn').onclick = () => {
    overlay.classList.remove('open');
    document.getElementById('userPhotoInput').value = '';
    endDrag();
  };

  document.getElementById('applyCropBtn').onclick = () => applyCrop();
}

function updateCropTransform() {
  const cropImg = document.getElementById('cropImage');
  const scaledWidth = cropState.originalWidth * cropState.scale;
  const scaledHeight = cropState.originalHeight * cropState.scale;
  cropImg.style.width = `${scaledWidth}px`;
  cropImg.style.height = `${scaledHeight}px`;
  cropImg.style.left = `${cropState.x}px`;
  cropImg.style.top = `${cropState.y}px`;
}

function applyCrop() {
  const cropImg = document.getElementById('cropImage');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Reduzido para 200x200 para economizar localStorage
  canvas.width = 200;
  canvas.height = 200;

  const ratio = cropImg.naturalWidth / (cropState.originalWidth * cropState.scale);
  const sx = Math.abs(cropState.x) * ratio;
  const sy = Math.abs(cropState.y) * ratio;
  const sSize = cropState.viewportSize * ratio;

  // Desenha no canvas com o recorte e redimensionamento
  ctx.drawImage(cropImg, sx, sy, sSize, sSize, 0, 0, 200, 200);

  // Qualidade reduzida para 0.7 para compressão eficiente
  const photoData = canvas.toDataURL('image/jpeg', 0.7);
  
  if (cropState.appState) {
    cropState.appState.profile.photo = photoData;
    updateAvatarDisplay(cropState.appState.profile);
    
    // Salva imediatamente no localStorage para persistência
    if (typeof saveState === 'function') saveState(cropState.appState);
    
    const removeBtn = document.getElementById('removePhotoBtn');
    if (removeBtn) removeBtn.style.display = 'block';
  }

  document.getElementById('cropEditorOverlay').classList.remove('open');
  if (typeof showToast === 'function') showToast('✨ Foto atualizada com sucesso!');
}

function saveProfile(appState) {
  const nameInput = document.getElementById('userNameInput');
  const focusInput = document.getElementById('focusTimeInput');
  const breakInput = document.getElementById('breakTimeInput');

  appState.profile.name = (nameInput?.value || 'Usuário').trim() || 'Usuário';
  appState.profile.focusTime = parseInt(focusInput?.value) || 25;
  appState.profile.breakTime = parseInt(breakInput?.value) || 5;

  saveState(appState);
  updateAvatarDisplay(appState.profile);
  closeModal('profileModal');
  showToast('👤 Perfil salvo!');
}
