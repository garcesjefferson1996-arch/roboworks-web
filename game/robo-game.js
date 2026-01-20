document.addEventListener('DOMContentLoaded', () => {

  const pieces = document.querySelectorAll('.piece');
  const zones = document.querySelectorAll('.drop-zone');
  const finish = document.getElementById('game-finish');

  let activePiece = null;
  let completed = 0;

  // ===== PIEZAS =====
  pieces.forEach(piece => {

    // Mouse
    piece.draggable = true;
    piece.addEventListener('dragstart', () => {
      activePiece = piece.dataset.piece;
    });

    // Touch
    piece.addEventListener('touchstart', () => {
      activePiece = piece.dataset.piece;
    });

  });

  // ===== ZONAS =====
  zones.forEach(zone => {

    zone.addEventListener('dragover', e => e.preventDefault());

    zone.addEventListener('drop', () => {
      placePiece(zone);
    });

    zone.addEventListener('touchend', () => {
      placePiece(zone);
    });

  });

  // ===== LÓGICA =====
  function placePiece(zone) {
    if (
      activePiece &&
      zone.dataset.piece === activePiece &&
      !zone.classList.contains('filled')
    ) {
      zone.classList.add('filled');
      zone.textContent = '✔️';
      completed++;

      if (completed === zones.length) {
        setTimeout(() => {
          finish.classList.remove('hidden');
        }, 400);
      }
    }
  }

});
