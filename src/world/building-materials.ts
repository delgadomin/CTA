import * as THREE from 'three';
import type { BuildingMaterial } from './types';

type FacadeStyle = 'casco' | 'ensanche' | 'periferia';

const PALETTES: Readonly<Record<FacadeStyle, readonly string[]>> = {
  casco: ['#ceb99a', '#d9c8aa', '#b8b0a1', '#c8b99f'],
  ensanche: ['#d8cdb9', '#bfaa91', '#d4d0c6', '#c9b7a3'],
  periferia: ['#b9bbb7', '#c9c2b7', '#b7a999', '#9eaaa8'],
};

function seeded(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

function canvasTexture(canvas: HTMLCanvasElement, repeat: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

function drawFacade(style: FacadeStyle, emissive: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create procedural facade texture.');
  const tile = 128;
  const columns = 8;
  const rows = 4;
  canvas.width = tile * columns;
  canvas.height = tile * rows;
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * tile;
      const y = row * tile;
      const random = seeded(row * 31 + column * 137 + style.length * 17);
      const upper = row === 1 || row === 2;
      const palette = PALETTES[style];
      context.fillStyle = palette[column % palette.length] ?? '#c9b99f';
      context.fillRect(x, y, tile, tile);
      context.fillStyle = style === 'casco' ? '#b19d7e' : '#8f8d84';
      context.fillRect(x, y + tile - 10, tile, 10);
      context.fillStyle = style === 'casco' ? '#5a4739' : '#44494a';
      const windowX = x + 34 + Math.round(random * 10);
      const windowY = y + (upper ? 25 : 31);
      const windowWidth = style === 'casco' ? 34 : 42;
      const windowHeight = upper ? 54 : 50;
      context.fillRect(windowX - 4, windowY - 4, windowWidth + 8, windowHeight + 8);
      context.fillStyle = emissive
        ? (random > 0.58 ? '#ffe4a0' : '#040302')
        : style === 'casco' ? '#91a4a1' : '#839799';
      context.fillRect(windowX, windowY, windowWidth, windowHeight);
      if (!emissive) {
        context.fillStyle = style === 'casco' ? '#665646' : '#4a5050';
        context.fillRect(windowX + windowWidth / 2 - 2, windowY, 4, windowHeight);
        context.fillRect(windowX, windowY + windowHeight * 0.55, windowWidth, 3);
        if (row === 2) {
          context.strokeStyle = style === 'casco' ? '#3c3027' : '#5a5651';
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(windowX - 9, windowY + windowHeight + 7);
          context.lineTo(windowX + windowWidth + 9, windowY + windowHeight + 7);
          context.moveTo(windowX - 5, windowY + windowHeight + 2);
          context.lineTo(windowX - 5, windowY + windowHeight + 15);
          context.moveTo(windowX + windowWidth + 5, windowY + windowHeight + 2);
          context.lineTo(windowX + windowWidth + 5, windowY + windowHeight + 15);
          context.stroke();
        }
        if (row === 3) {
          context.fillStyle = '#4c5554';
          context.fillRect(x + 16, y + 25, 18, 88);
          context.fillRect(x + 94, y + 32, 18, 81);
          context.fillStyle = '#85928d';
          context.fillRect(x + 39, y + 43, 49, 54);
        }
        context.fillStyle = style === 'casco' ? '#e1d2b6' : '#eee8dc';
        context.fillRect(x, y + 5, tile, 5);
      }
    }
  }
  return canvas;
}

function drawRoof(tile: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create procedural roof texture.');
  canvas.width = 256;
  canvas.height = 256;
  context.fillStyle = tile ? '#98664b' : '#8c8b84';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (tile) {
    for (let row = 0; row < 16; row += 1) {
      const offset = row % 2 === 0 ? 0 : 8;
      for (let column = -1; column < 16; column += 1) {
        const x = column * 16 + offset;
        const y = row * 16;
        context.fillStyle = ['#a56e4e', '#9c6548', '#ad7554'][(row + column + 48) % 3] ?? '#9c6548';
        context.beginPath();
        context.ellipse(x + 8, y + 7, 8, 7, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#754d3b';
        context.lineWidth = 1;
        context.stroke();
      }
    }
  } else {
    context.strokeStyle = '#aaa89f';
    context.lineWidth = 3;
    for (let offset = 0; offset <= 256; offset += 32) {
      context.beginPath(); context.moveTo(offset, 0); context.lineTo(offset, 256); context.stroke();
      context.beginPath(); context.moveTo(0, offset); context.lineTo(256, offset); context.stroke();
    }
  }
  return canvas;
}

function drawMonumentStone(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create procedural stone texture.');
  canvas.width = 256;
  canvas.height = 256;
  context.fillStyle = '#b9aa8d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 8; row += 1) {
    const offset = row % 2 === 0 ? 0 : 16;
    for (let column = -1; column < 8; column += 1) {
      const x = column * 32 + offset;
      const y = row * 32;
      const tone = (row * 11 + column * 7 + 84) % 5;
      context.fillStyle = ['#c9b99b', '#b9aa8d', '#c1b398', '#ad9d82', '#d0c2a6'][tone] ?? '#b9aa8d';
      context.fillRect(x + 1, y + 1, 30, 30);
      context.strokeStyle = '#8f8069';
      context.lineWidth = 2;
      context.strokeRect(x + 1, y + 1, 30, 30);
    }
  }
  return canvas;
}

export function createBuildingMaterials(): Map<BuildingMaterial, THREE.MeshStandardMaterial> {
  const casco = drawFacade('casco', false);
  const ensanche = drawFacade('ensanche', false);
  const periferia = drawFacade('periferia', false);
  const cascoGlow = drawFacade('casco', true);
  const ensancheGlow = drawFacade('ensanche', true);
  const periferiaGlow = drawFacade('periferia', true);
  const facade = (map: HTMLCanvasElement, glow: HTMLCanvasElement): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
    map: canvasTexture(map, false),
    emissive: '#ffca77',
    emissiveMap: canvasTexture(glow, false),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const roof = (tile: boolean): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
    map: canvasTexture(drawRoof(tile), true),
    vertexColors: true,
    roughness: tile ? 0.91 : 0.76,
    side: THREE.DoubleSide,
  });
  const monumentStone = new THREE.MeshStandardMaterial({
    map: canvasTexture(drawMonumentStone(), true),
    vertexColors: true,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  return new Map([
    ['casco_facade', facade(casco, cascoGlow)],
    ['ensanche_facade', facade(ensanche, ensancheGlow)],
    ['periferia_facade', facade(periferia, periferiaGlow)],
    ['tile_roof', roof(true)],
    ['modern_roof', roof(false)],
    ['monument_stone', monumentStone],
  ]);
}
