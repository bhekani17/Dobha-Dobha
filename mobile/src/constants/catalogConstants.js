/**
 * Catalog Screen Constants
 * Categories, terms, and configuration values
 */

export const CATEGORIES = [
  { id: 'all', label: 'All Thrift' },
  { id: 'jackets', label: 'Jackets & Windbreakers' },
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'tees', label: 'Vintage Tees' },
  { id: 'bales', label: 'Wholesale Bales' },
  { id: 'denim', label: 'Denim & Pants' }
];

export const CATEGORY_TERMS = {
  jackets: ['jacket', 'coat', 'windbreaker', 'puffer', 'parka'],
  sneakers: ['sneaker', 'shoe', 'trainer', 'air max', 'samba', 'dunk'],
  tees: ['tee', 't-shirt', 'shirt', 'fleece', 'hoodie'],
  bales: ['bale', 'wholesale', 'bulk', 'bundle'],
  denim: ['denim', 'jean', 'pants', 'trouser']
};

export const CARD_STYLES = {
  CARD_WIDTH_PERCENTAGE: '48.2%',
  CARD_BORDER_RADIUS: 18,
  IMAGE_HEIGHT: 155,
  PADDING: 12
};

export const SPACING = {
  GRID_GAP: 14,
  CATEGORY_GAP: 6,
  SEARCH_BAR_MARGIN: 12
};

export const FONT_SIZES = {
  CARD_TITLE: 13.5,
  CARD_LOCATION: 11,
  CARD_PRICE: 16,
  CATEGORY_TEXT: 10
};