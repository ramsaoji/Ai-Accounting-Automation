import fs from 'fs';
import path from 'path';

/**
 * Resolves the location of a target file inside project directories,
 * checking standard paths and extensions to gracefully handle file inputs.
 */
export async function resolveTargetFile(inputFilePath: string, inputDir: string): Promise<string> {
  const isFile = async (p: string) => {
    try {
      const stat = await fs.promises.stat(p);
      return stat.isFile();
    } catch {
      return false;
    }
  };

  // 1. Try raw input path
  let target = path.resolve(process.cwd(), inputFilePath);
  if (await isFile(target)) return target;

  // 2. Try with .xlsx extension appended
  target = path.resolve(process.cwd(), inputFilePath + '.xlsx');
  if (await isFile(target)) return target;

  // 3. Try inside inputDir folder
  target = path.join(inputDir, inputFilePath);
  if (await isFile(target)) return target;

  // 4. Try inside inputDir with .xlsx extension appended
  target = path.join(inputDir, inputFilePath + '.xlsx');
  if (await isFile(target)) return target;

  // 5. Try basename check in inputDir
  const baseName = path.basename(inputFilePath);
  target = path.join(inputDir, baseName);
  if (await isFile(target)) return target;

  // 6. Try basename in inputDir with .xlsx appended
  target = path.join(inputDir, baseName + '.xlsx');
  if (await isFile(target)) return target;

  throw new Error(`Could not resolve input file "${inputFilePath}" inside the input directory "${inputDir}". Please verify the file exists.`);
}
