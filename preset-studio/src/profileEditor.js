import Cropper from 'cropperjs';
import { createUiEventController } from './game/client/uiEventController.js';

let activeEditor = null;

export function setProfileEditorEditable(editable) {
  activeEditor?.setEditable(editable);
}

function resolveElements(documentRoot) {
  return {
    avatar: documentRoot?.getElementById('profile-modal-avatar'),
    modal: documentRoot?.getElementById('crop-modal'),
    urlInput: documentRoot?.getElementById('crop-image-url'),
    loadButton: documentRoot?.getElementById('btn-crop-load'),
    cancelButtons: [
      documentRoot?.getElementById('btn-crop-cancel1'),
      documentRoot?.getElementById('btn-crop-cancel2')
    ],
    saveButton: documentRoot?.getElementById('btn-crop-save'),
    inputSection: documentRoot?.getElementById('crop-input-section'),
    editSection: documentRoot?.getElementById('crop-edit-section'),
    imagePreview: documentRoot?.getElementById('crop-image-preview')
  };
}

function rememberAttribute(element, name) {
  return element?.hasAttribute(name) ? element.getAttribute(name) : null;
}

function restoreAttribute(element, name, value) {
  if (!element) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

export function createProfileEditor({
  documentRoot = globalThis.document,
  elements = resolveElements(documentRoot),
  CropperClass = Cropper,
  getCurrentUser,
  updateUserAvatar,
  renderAvatar,
  renderProfileAvatar,
  updateProfileCache,
  alertUser = globalThis.alert
}) {
  const events = createUiEventController();
  const {
    avatar,
    modal,
    urlInput,
    loadButton,
    cancelButtons = [],
    saveButton,
    inputSection,
    editSection,
    imagePreview
  } = elements;
  const initialAvatarAttributes = {
    role: rememberAttribute(avatar, 'role'),
    tabindex: rememberAttribute(avatar, 'tabindex'),
    ariaLabel: rememberAttribute(avatar, 'aria-label')
  };

  let cropperInstance = null;
  let editable = false;
  let disposed = false;
  let loadRevision = 0;
  let saving = false;

  function destroyCropper() {
    cropperInstance?.destroy();
    cropperInstance = null;
  }

  function restoreAvatarAccessibility() {
    restoreAttribute(avatar, 'role', initialAvatarAttributes.role);
    restoreAttribute(avatar, 'tabindex', initialAvatarAttributes.tabindex);
    restoreAttribute(avatar, 'aria-label', initialAvatarAttributes.ariaLabel);
  }

  function close() {
    loadRevision++;
    modal?.classList.add('hidden');
    destroyCropper();
    if (imagePreview) {
      imagePreview.onload = null;
      imagePreview.onerror = null;
    }
  }

  function open() {
    if (disposed || !editable || !modal) return;
    if (!getCurrentUser?.()) {
      alertUser?.('로그인이 필요합니다.');
      return;
    }
    loadRevision++;
    destroyCropper();
    modal.classList.remove('hidden');
    inputSection?.classList.remove('hidden');
    editSection?.classList.add('hidden');
    if (urlInput) urlInput.value = '';
  }

  function load() {
    if (disposed || !editable) return;
    const url = urlInput?.value?.trim() || '';
    if (!url) {
      alertUser?.('이미지 링크를 입력하세요.');
      return;
    }
    if (!imagePreview) return;

    const revision = ++loadRevision;
    destroyCropper();
    imagePreview.onload = () => {
      if (disposed || revision !== loadRevision) return;
      inputSection?.classList.add('hidden');
      editSection?.classList.remove('hidden');
      destroyCropper();
      cropperInstance = new CropperClass(imagePreview, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false
      });
    };
    imagePreview.onerror = () => {
      if (disposed || revision !== loadRevision) return;
      alertUser?.('이미지를 불러올 수 없습니다. 올바른 URL인지, 혹은 CORS 제한이 없는지 확인해주세요.');
    };
    imagePreview.crossOrigin = 'Anonymous';
    imagePreview.src = url;
  }

  async function save() {
    if (disposed || saving || !cropperInstance) return;
    const user = getCurrentUser?.();
    const url = urlInput?.value?.trim() || '';
    if (!user?.uid || !url) return;

    const revision = loadRevision;
    const cropData = cropperInstance.getData(true);
    saving = true;
    try {
      const success = await updateUserAvatar?.(user.uid, url, cropData);
      if (disposed || revision !== loadRevision) return;
      if (!success) {
        alertUser?.('아바타 저장에 실패했습니다.');
        return;
      }
      renderAvatar?.(url, cropData);
      renderProfileAvatar?.(avatar, url, cropData);
      updateProfileCache?.(user.uid, { avatarUrl: url, cropData });
      close();
    } finally {
      saving = false;
    }
  }

  function setEditable(nextEditable) {
    if (disposed) return;
    editable = Boolean(nextEditable);
    if (editable) {
      avatar?.setAttribute('role', 'button');
      avatar?.setAttribute('tabindex', '0');
      avatar?.setAttribute('aria-label', '프로필 사진 편집');
      return;
    }
    close();
    restoreAvatarAccessibility();
  }

  function handleAvatarKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  }

  events.bind(avatar, 'click', open);
  events.bind(avatar, 'keydown', handleAvatarKeydown);
  events.bind(loadButton, 'click', load);
  cancelButtons.forEach(button => events.bind(button, 'click', close));
  events.bind(saveButton, 'click', save);

  const editor = {
    setEditable,
    dispose() {
      if (disposed) return;
      disposed = true;
      editable = false;
      events.dispose();
      close();
      restoreAvatarAccessibility();
      if (activeEditor === editor) activeEditor = null;
    }
  };
  activeEditor = editor;
  restoreAvatarAccessibility();
  return editor;
}
