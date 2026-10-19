import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sanitizeJpeg } from '../lib/vision/jpeg';

const image=(width:number,height:number,options:{progressive?:boolean}={})=>sharp({create:{width,height,channels:3,background:{r:200,g:60,b:40}}}).jpeg({quality:70,progressive:options.progressive});

describe('dependency-free JPEG sanitizer',()=>{
 it('removes EXIF and other metadata while keeping a decodable image',async()=>{
  const original=await image(320,240).withExif({IFD0:{Copyright:'secret-owner',ImageDescription:'home address'}}).toBuffer();
  expect(original.includes(Buffer.from('secret-owner'))).toBe(true);
  const clean=sanitizeJpeg(original);
  expect(clean.includes(Buffer.from('secret-owner'))).toBe(false);
  const meta=await sharp(clean).metadata();
  expect([meta.width,meta.height,meta.format]).toEqual([320,240,'jpeg']);
  expect(meta.exif).toBeUndefined();
  const pixels=await sharp(clean).raw().toBuffer();expect(pixels.length).toBe(320*240*3);
 });
 it('handles progressive JPEGs with several scans',async()=>{
  const clean=sanitizeJpeg(await image(200,150,{progressive:true}).toBuffer());
  expect((await sharp(clean).metadata()).isProgressive).toBe(true);
 });
 it('rejects oversized, truncated and non-JPEG input',async()=>{
  expect(()=>sanitizeJpeg(Buffer.from('not a jpeg'))).toThrow('missing start marker');
  const big=await image(1100,1000).toBuffer();
  expect(()=>sanitizeJpeg(big)).toThrow('dimensions out of range');
  const small=await image(64,64).toBuffer();
  expect(()=>sanitizeJpeg(small.subarray(0,small.length-40))).toThrow('Invalid JPEG');
  expect(()=>sanitizeJpeg(Buffer.from([0xff,0xd8,0xff,0xd9]))).toThrow('no image data');
 });
});
