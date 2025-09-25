(function initUtils(window) {
  const App = window.NostrApp || (window.NostrApp = {});

  App.escapeHtml = function escapeHtml(value = '') {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#039;';
        default:
          return char;
      }
    });
  };

  App.getInitials = function getInitials(source = '') {
    const words = source.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return 'AN';
    }
    return words
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  App.resizeImageToDataUrl = async function resizeImageToDataUrl(
    file,
    maxWidth = 256,
    maxHeight = 256,
    quality = 0.85
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length > window.NostrApp.MAX_INLINE_PICTURE_LENGTH && quality > 0.4) {
            resolve(App.resizeImageToDataUrl(file, maxWidth / 1.5, maxHeight / 1.5, quality - 0.1));
            return;
          }
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
})(window);
