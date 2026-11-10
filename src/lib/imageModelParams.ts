import type { ApiProfile, TaskParams } from '../types'
import { getImageModelFamily, supportsGrokQuality, usesGrokSizeParams } from './imageModels'
import { formatImageRatio, parseRatio } from './size'

export function getImageModelOptions(profile: ApiProfile) {
  const family = getImageModelFamily(profile)
  const model = profile.model.toLowerCase()
  const ratios = ['auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']
  if (family === 'grok') {
    if (usesGrokSizeParams(profile)) return { ratios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3'], resolutions: [] }
    return { ratios: [...ratios.filter((ratio) => ratio !== '4:5' && ratio !== '5:4'), '9:19.5', '19.5:9', '9:20', '20:9', '1:2', '2:1', '5:2'], resolutions: ['1K', '2K'] }
  }
  const firstGeneration = /gemini-2\.5-|(?:^|\/)nano[-_]?banana(?:$|-(?:image|preview))/.test(model)
  const flashLite = /flash-lite-image/.test(model)
  const flash31 = /gemini-3\.1-.*image|nano[-_]?banana-2(?:$|[^.])/.test(model)
  return {
    ratios: firstGeneration || flashLite || /gemini-3-pro/.test(model) ? ratios : [...ratios, '1:4', '4:1', '1:8', '8:1'],
    resolutions: profile.provider === 'google' && /gemini-2\.5-/.test(model) ? []
      : firstGeneration || flashLite ? ['1K'] : flash31 && profile.provider === 'google' ? ['512', '1K', '2K', '4K'] : ['1K', '2K', '4K'],
  }
}

export function getImageModelParams(profile: ApiProfile, params: TaskParams): { aspect_ratio: string; resolution: string | undefined; quality: TaskParams['quality'] | undefined } {
  const family = getImageModelFamily(profile)
  const options = getImageModelOptions(profile)
  const legacySize = family === 'grok' && params.aspect_ratio === undefined ? parseRatio(params.size) : null
  const ratio = params.aspect_ratio ?? (legacySize ? formatImageRatio(legacySize.width, legacySize.height).replace(/^≈/, '') : 'auto')
  const aspectRatio = options.ratios.includes(ratio) ? ratio : 'auto'
  const resolution = options.resolutions.includes(params.resolution?.toUpperCase() ?? '') ? params.resolution!.toUpperCase() : legacySize && legacySize.width * legacySize.height > 1_572_864 ? '2K' : '1K'
  return {
    aspect_ratio: aspectRatio,
    resolution: options.resolutions.length ? resolution : undefined,
    quality: family === 'grok' && supportsGrokQuality(profile.model)
      ? params.quality === 'low' ? 'low' : 'medium'
      : undefined,
  }
}
