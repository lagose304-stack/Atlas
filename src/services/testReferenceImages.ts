import { deleteFromCloudinary, getCloudinaryPublicId } from './cloudinary';

const TEST_REFERENCE_FOLDER_ROOT = 'pruebas/referencias';

export const getTestReferenceFolder = (pruebaId: string): string =>
  `${TEST_REFERENCE_FOLDER_ROOT}/${pruebaId}`;

export const isOwnedTestReferenceUrl = (url: string | null | undefined, pruebaId?: string): boolean => {
  if (!url) return false;

  const publicId = getCloudinaryPublicId(url);
  if (!publicId) return false;

  const expectedPrefix = pruebaId
    ? `${getTestReferenceFolder(pruebaId)}/`
    : `${TEST_REFERENCE_FOLDER_ROOT}/`;

  return publicId.startsWith(expectedPrefix);
};

export interface TestReferenceCleanupResult {
  deleted: string[];
  failed: string[];
}

export const deleteOwnedTestReferenceImages = async (
  urls: Array<string | null | undefined>,
  pruebaId: string
): Promise<TestReferenceCleanupResult> => {
  const ownedUrls = Array.from(new Set(
    urls.filter((url): url is string => isOwnedTestReferenceUrl(url, pruebaId))
  ));
  const result: TestReferenceCleanupResult = { deleted: [], failed: [] };

  for (const url of ownedUrls) {
    let deleted = false;

    for (let attempt = 0; attempt < 2 && !deleted; attempt += 1) {
      try {
        await deleteFromCloudinary({ imageUrl: url });
        deleted = true;
      } catch {
        deleted = false;
      }
    }

    if (deleted) {
      result.deleted.push(url);
    } else {
      result.failed.push(url);
    }
  }

  return result;
};
