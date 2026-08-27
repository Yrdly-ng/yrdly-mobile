import { supabase } from './supabase';
import type { CatalogItem } from '@/types';
import { StorageService, MobileFile } from '@/lib/storage-service';
import { ModerationService } from '@/lib/moderation-service';

export class CatalogService {
  /**
   * Create a new catalog item for a business
   */
  static async createCatalogItem(
    businessId: string,
    itemData: {
      title: string;
      description: string;
      price: number;
      category?: string;
      in_stock?: boolean;
      quantity?: number;
    },
    imageFiles?: MobileFile[]
  ): Promise<string> {
    try {
      // Verify business ownership
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || business.owner_id !== user.id) {
        throw new Error('Unauthorized: You do not own this business');
      }

      // Moderate text
      let moderationStatus = 'approved';
      let moderationReason = '';
      const textToModerate = `${itemData.title} ${itemData.description}`;
      const textMod = await ModerationService.checkText(textToModerate);
      if (!textMod.isSafe) {
        moderationStatus = 'pending';
        moderationReason = textMod.reason || 'Flagged text content';
      }

      // Upload images if provided
      let imageUrls: string[] = [];
      if (imageFiles && imageFiles.length > 0) {
        imageUrls = await this.uploadImages(businessId, imageFiles);
      }

      // Insert catalog item
      const { data, error } = await supabase
        .from('catalog_items')
        .insert({
          business_id: businessId,
          title: itemData.title,
          description: itemData.description,
          price: itemData.price,
          category: itemData.category || 'General',
          images: imageUrls,
          in_stock:
            (itemData.quantity !== undefined ? itemData.quantity > 0 : true) &&
            (itemData.in_stock ?? true),
          quantity: itemData.quantity ?? 1,
          moderation_status: moderationStatus,
        })
        .select('id')
        .single();

      if (error) throw error;

      if (moderationStatus === 'pending' && data) {
        await supabase.from('moderation_queue').insert({
          content_id: data.id,
          table_name: 'catalog_items',
          user_id: user.id,
          status: 'pending',
          reason: moderationReason,
          text_content: textToModerate,
          image_urls: imageUrls,
        });
      }

      console.log('Catalog item created successfully', {
        itemId: data.id,
        businessId,
      });

      return data.id;
    } catch (error) {
      console.error('Error creating catalog item:', error);
      throw new Error('Failed to create catalog item');
    }
  }

  /**
   * Update an existing catalog item
   */
  static async updateCatalogItem(
    itemId: string,
    businessId: string,
    itemData: Partial<{
      title: string;
      description: string;
      price: number;
      category: string;
      in_stock: boolean;
      quantity: number;
    }>,
    newImageFiles?: MobileFile[],
    existingImages?: string[]
  ): Promise<void> {
    try {
      // Verify business ownership
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || business.owner_id !== user.id) {
        throw new Error('Unauthorized: You do not own this business');
      }

      // Moderate text if provided
      let moderationStatus = 'approved';
      let moderationReason = '';
      let textToModerate = '';
      if (itemData.title || itemData.description) {
        textToModerate = `${itemData.title || ''} ${itemData.description || ''}`;
        if (textToModerate.trim()) {
          const textMod = await ModerationService.checkText(textToModerate);
          if (!textMod.isSafe) {
            moderationStatus = 'pending';
            moderationReason = textMod.reason || 'Flagged text content';
          }
        }
      }

      // Upload new images if provided
      let newImageUrls: string[] = [];
      if (newImageFiles && newImageFiles.length > 0) {
        newImageUrls = await this.uploadImages(businessId, newImageFiles);
      }

      // Combine existing and new images
      const allImages = [...(existingImages || []), ...newImageUrls];

      // Update catalog item
      const updateData: any = { ...itemData };
      if (newImageFiles || existingImages) {
        updateData.images = allImages;
      }
      updateData.moderation_status = moderationStatus;
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('catalog_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('business_id', businessId);

      if (error) throw error;

      if (moderationStatus === 'pending') {
        await supabase.from('moderation_queue').insert({
          content_id: itemId,
          table_name: 'catalog_items',
          user_id: user.id,
          status: 'pending',
          reason: moderationReason,
          text_content: textToModerate,
          image_urls: allImages,
        });
      }

      console.log('Catalog item updated successfully', {
        itemId,
        businessId,
      });
    } catch (error) {
      console.error('Error updating catalog item:', error);
      throw new Error('Failed to update catalog item');
    }
  }

  /**
   * Delete a catalog item
   */
  static async deleteCatalogItem(itemId: string, businessId: string): Promise<void> {
    try {
      // Verify business ownership
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || business.owner_id !== user.id) {
        throw new Error('Unauthorized: You do not own this business');
      }

      // Get item images to delete from storage
      const { data: item } = await supabase
        .from('catalog_items')
        .select('images')
        .eq('id', itemId)
        .eq('business_id', businessId)
        .single();

      // Delete catalog item
      const { error } = await supabase
        .from('catalog_items')
        .delete()
        .eq('id', itemId)
        .eq('business_id', businessId);

      if (error) throw error;

      // Delete images from storage
      if (item?.images && item.images.length > 0) {
        await this.deleteImages(item.images);
      }

      console.log('Catalog item deleted successfully', {
        itemId,
        businessId,
      });
    } catch (error) {
      console.error('Error deleting catalog item:', error);
      throw new Error('Failed to delete catalog item');
    }
  }

  /**
   * Toggle stock status of a catalog item
   */
  static async toggleStockStatus(
    itemId: string,
    businessId: string,
    inStock: boolean
  ): Promise<void> {
    try {
      // Verify business ownership
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || business.owner_id !== user.id) {
        throw new Error('Unauthorized: You do not own this business');
      }

      // Update stock status
      const { error } = await supabase
        .from('catalog_items')
        .update({
          in_stock: inStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('business_id', businessId);

      if (error) throw error;

      console.log('Catalog item stock status updated', {
        itemId,
        businessId,
        inStock,
      });
    } catch (error) {
      console.error('Error toggling stock status:', error);
      throw new Error('Failed to update stock status');
    }
  }

  /**
   * Get all catalog items for a business
   */
  static async getCatalogItemsByBusiness(businessId: string): Promise<CatalogItem[]> {
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as CatalogItem[];
    } catch (error) {
      console.error('Error fetching catalog items:', error);
      throw new Error('Failed to fetch catalog items');
    }
  }

  /**
   * Upload images to Supabase storage
   */
  private static async uploadImages(
    businessId: string,
    imageFiles: MobileFile[]
  ): Promise<string[]> {
    const imageUrls: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${businessId}/${Date.now()}-${i}.${fileExt}`;

      const { data, error } = await StorageService.uploadFile('pending-moderation', fileName, file);

      if (error || !data) {
        console.error('Error uploading image:', error);
        continue;
      }

      imageUrls.push(StorageService.getPublicUrl('pending-moderation', fileName));
    }

    return imageUrls;
  }

  /**
   * Delete images from Supabase storage
   */
  private static async deleteImages(imageUrls: string[]): Promise<void> {
    try {
      const filePaths = imageUrls
        .map((url) => {
          const urlParts = url.split('/catalog-items/');
          return urlParts[1];
        })
        .filter(Boolean);

      if (filePaths.length > 0) {
        await supabase.storage.from('catalog-items').remove(filePaths);
      }
    } catch (error) {
      console.error('Error deleting images:', error);
      // Don't throw error, as item is already deleted
    }
  }
}
