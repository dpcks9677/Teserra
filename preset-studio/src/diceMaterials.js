import * as THREE from 'three';

export function getMaterialForDie(config) {
  const materials = [];
  const type = config.type || 'normal';
  
  let bgColor = '#F5F5F0';
  let dotColor = '#141414';
  
  if (type === 'golden') { bgColor = '#E0B338'; dotColor = '#291A0A'; }
  else if (type === 'metal') { bgColor = '#B2BABB'; dotColor = '#0F172A'; }
  else if (type === 'sevens') { bgColor = '#2DD4BF'; dotColor = '#042F2E'; }
  else if (type === 'couple') { bgColor = '#F43F5E'; dotColor = '#4C0519'; }
  else if (type === 'promotion') { bgColor = '#334155'; dotColor = '#F59E0B'; }
  else if (type === 'weird') { bgColor = '#7E22CE'; dotColor = '#A7F3D0'; }
  else if (type === 'octahedron') { bgColor = '#002F5E'; dotColor = '#ffffff'; }
  else if (type === 'heavy' || type === 'heavyRed') { bgColor = '#BD1C18'; dotColor = '#FAFAFA'; }
  
  if (config.color) bgColor = config.color;

  const numFaces = type === 'octahedron' ? 8 : 6;
  
  for (let i = 1; i <= numFaces; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 256);
    
    if (type !== 'octahedron') {
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 10;
      ctx.strokeRect(0,0,256,256);
    }
    
    const drawText = (text) => {
       ctx.fillStyle = dotColor;
       ctx.font = 'bold 120px sans-serif';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       ctx.fillText(text, 128, 128);
    };

    const drawDot = (x, y) => {
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();

      // 음각 인셋 입체감 (상단 내부 그림자 + 하단 림 하이라이트)
      const grad = ctx.createLinearGradient(x, y - 25, x, y + 25);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.0)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();
    };
    
    const cx = 128, cy = 128, offset = 60;
    
    let drawValue = i;
    if (type === 'heavy') {
      const mapping = {1: 4, 2: 4, 3: 5, 4: 5, 5: 6, 6: 6};
      drawValue = mapping[i];
    } else if (type === 'sevens') {
      drawValue = i + 1;
    } else if (type === 'octahedron') {
      const mapping = {1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 5, 7: 5, 8: 6};
      drawValue = mapping[i];
    }

    if (type === 'octahedron') {
      drawText(drawValue.toString());
    } else if (type === 'weird') {
      if (i === 1) drawText('+2');
      else if (i === 2 || i === 3) drawText('+1');
      else if (i === 4) drawText('0');
      else if (i === 5) drawText('-1');
      else if (i === 6) drawText('💀');
    } else if (type === 'promotion') {
      const pLevel = config.promotionLevel || 0;
      let actualValue = 1 + pLevel;
      if (actualValue > 6) actualValue = 6;
      
      if ([1,3,5].includes(actualValue)) drawDot(cx, cy);
      if ([2,3,4,5,6].includes(actualValue)) { drawDot(cx - offset, cy - offset); drawDot(cx + offset, cy + offset); }
      if ([4,5,6].includes(actualValue)) { drawDot(cx + offset, cy - offset); drawDot(cx - offset, cy + offset); }
      if (actualValue === 6) { drawDot(cx - offset, cy); drawDot(cx + offset, cy); }
    } else {
      if ([1,3,5,7].includes(drawValue)) drawDot(cx, cy);
      if ([2,3,4,5,6,7].includes(drawValue)) { drawDot(cx - offset, cy - offset); drawDot(cx + offset, cy + offset); }
      if ([4,5,6,7].includes(drawValue)) { drawDot(cx + offset, cy - offset); drawDot(cx - offset, cy + offset); }
      if ([6,7].includes(drawValue)) { drawDot(cx - offset, cy); drawDot(cx + offset, cy); }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    materials.push(new THREE.MeshStandardMaterial({ 
      map: tex,
      // 일반 흰 주사위는 무광으로 처리해 강한 하이라이트가 눈을 덮지 않게 한다.
      roughness: type === 'golden' ? 0.05 : type === 'metal' ? 0.18 : type === 'normal' ? 0.42 : 0.15,
      metalness: type === 'golden' ? 0.8 : type === 'metal' ? 0.95 : type === 'normal' ? 0 : 0.1
    }));
  }
  
  if (type !== 'octahedron') {
    return [
      materials[2], // 3
      materials[3], // 4
      materials[0], // 1
      materials[5], // 6
      materials[1], // 2
      materials[4], // 5
    ];
  } else {
    return materials;
  }
}
