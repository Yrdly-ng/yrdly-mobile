// Generated from original mobile source. Static reference harness; never imports network clients.
export function Avatar({
  url,
  viewable = false,
  name,
  size = 150,
  style,
  fallbackStyle,
  fallbackTextStyle,
}: AvatarProps) {
  const { theme } = useUnistyles();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Guard against file:// URLs from broken uploads saving local URIs
  const isValidUrl = !!url && !url.startsWith('file://') && failedUrl !== url;

  const finalUrl = isValidUrl ? StorageService.getOptimizedImageUrl(url, size) || url : null;

  const initials = (name || 'U').charAt(0).toUpperCase();

  // Extract dimensions to size the text dynamically if a size is provided in style
  const styleObj = (StyleSheet.flatten(style) || {}) as any;
  const dimension = styleObj.width || styleObj.height || size;

  if (isValidUrl && finalUrl) {
    const picture = (
      <Image
        source={{ uri: finalUrl }}
        style={viewable ? { width: '100%', height: '100%' } : (style as any)}
        contentFit="cover"
        recyclingKey={url}
        onError={() => setFailedUrl(url || null)}
      />
    );
    if (!viewable) return picture;
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name || 'user'}'s profile picture`}
          onPress={() => setViewerOpen(true)}
          style={[style as any, { overflow: 'hidden' }]}
        >
          {picture}
        </Pressable>
        <ImageViewing
          images={[{ uri: url! }]}
          imageIndex={0}
          visible={viewerOpen}
          onRequestClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  return (
    <View
      style={[
        {
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.SURFACE,
          overflow: 'hidden',
        },
        style as any,
        fallbackStyle,
      ]}
    >
      <Text
        style={[
          {
            fontFamily: 'Outfit-Bold',
            fontWeight: '700',
            fontSize: typeof dimension === 'number' ? dimension * 0.4 : 16,
            color: theme.colors.G,
          },
          fallbackTextStyle,
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}
export function MarketplaceFavorite({ item }: { item: Post }) {
  const {user}=useAuth();
  const [liked,setLiked]=useState(!!user&&!!item.liked_by?.includes(user.id));
  const busy=useRef(false);
  useEffect(()=>{setLiked(!!user&&!!item.liked_by?.includes(user.id));},[item.id,item.liked_by,user?.id]);
  async function toggle(){
    if(!user||busy.current)return;
    busy.current=true;const previous=liked;setLiked(!previous);
    try{
      const {data,error}=await supabase.rpc('toggle_post_like',{p_post_id:item.id,p_user_id:user.id});
      if(error||!data)throw error;
      setLiked(data.is_liked);
      DeviceEventEmitter.emit('post_updated',{postId:item.id,updates:{liked_by:data.liked_by}});
    }catch{setLiked(previous);}finally{busy.current=false;}
  }
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={liked?'Unlike listing':'Like listing'} accessibilityState={{selected:liked}} hitSlop={8}
    onPress={event=>{event.stopPropagation();void toggle();}}
    style={{position:'absolute',top:8,right:8,width:36,height:36,borderRadius:18,backgroundColor:'rgba(15,23,18,0.88)',alignItems:'center',justifyContent:'center'}}>
    <Ionicons name={liked?'heart':'heart-outline'} size={20} color={liked?'#FF6785':'#FFFFFF'}/>
  </TouchableOpacity>;
}
const stylesheet=StyleSheet.create((theme) => ({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.DARK,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingBottom: 20 },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnText: { fontFamily: 'Outfit-Bold', fontSize: 15 },
  title: { fontFamily: 'Outfit-ExtraBold', fontSize: 24, color: theme.colors.TEXT_PRIMARY },
  subtitle: { fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.LABEL },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.G,
    borderWidth: 1.5,
    borderColor: theme.colors.DARK,
  },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  cancelText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.G },

  // Section Pills
  sectionPill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionPillSelected: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  sectionPillText: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
  sectionPillTextSelected: { fontFamily: 'Inter-Bold', color: '#000' },

  sectionContainer: { flex: 1 },

  // Discover Section
  discoverGroup: { marginBottom: 24 },
  discoverGroupTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.LABEL,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  nearbyCard: {
    width: 155,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  nearbyAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    marginBottom: 12,
  },
  nearbyAvatar: { width: '100%', height: '100%' },
  nearbyInfo: { alignItems: 'center', marginBottom: 12 },
  nearbyName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  nearbyHandle: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.LABEL,
    marginBottom: 4,
  },
  nearbyDistRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nearbyDistText: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL },
  connectBtn: {
    width: '100%',
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(130,219,126,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnActive: {
    backgroundColor: 'rgba(130,219,126,0.15)',
    borderColor: 'rgba(130,219,126,0.4)',
  },
  connectBtnText: { fontFamily: 'Inter-Bold', fontSize: 13, color: theme.colors.G },
  connectBtnTextActive: { color: theme.colors.G },

  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
  },
  mutualAvatarWrap: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  mutualAvatar: { width: '100%', height: '100%' },
  mutualInfo: { flex: 1 },
  mutualName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  mutualSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL, marginTop: 2 },
  mutualMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.MUTED,
    marginTop: 4,
  },
  connectBtnSmall: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(130,219,126,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtnSmall: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: theme.colors.MUTED },

  // Marketplace Section
  marketplaceToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  marketplaceCatBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketplaceCatBtnActive: { backgroundColor: theme.colors.G, borderColor: theme.colors.G },
  marketplaceCatText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
  marketplaceCatTextActive: { fontFamily: 'Inter-Bold', color: '#000' },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },

  marketplaceCard: { width: (width - 40 - 16) / 2 },
  marketplaceCardImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  marketplaceCardImg: { width: '100%', height: '100%' },
  marketplaceCardSave: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,18,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketplaceCardCond: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(15,23,18,0.88)',
  },
  marketplaceCardCondText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  marketplaceCardTitle: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 13,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  marketplaceCardPrice: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 15,
    color: theme.colors.G,
    marginBottom: 4,
  },
  marketplaceCardSeller: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketplaceCardAvatarWrap: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden' },
  marketplaceCardAvatar: { width: '100%', height: '100%' },
  marketplaceCardArea: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.LABEL,
    flex: 1,
  },

  // Events Section
  eventsToolbar: { paddingBottom: 16 },
  eventCard: {
    width: '100%',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 24,
    overflow: 'hidden',
  },
  eventCardImgWrap: { width: '100%', height: 160, position: 'relative' },
  eventCardImg: { width: '100%', height: '100%' },
  eventCardGradient: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(5,5,5,0.75)',
    top: '40%',
  },
  eventCardDate: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,18,0.88)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  eventCardDateText: { fontFamily: 'Outfit-Bold', fontSize: 12, color: '#FFFFFF' },
  eventCardSave: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,18,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventCardPrice: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,18,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.28)',
  },
  eventCardPriceText: { fontFamily: 'Inter-Bold', fontSize: 11, color: theme.colors.G },
  eventCardInfo: { paddingHorizontal: 16, paddingVertical: 14 },
  eventCardTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 6,
  },
  eventCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  eventCardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventCardMetaText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },

  // Places Section
  placeRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 20,
    overflow: 'hidden',
  },
  placePhotoWrap: { width: 96, height: 96, flexShrink: 0 },
  placePhoto: { width: '100%', height: '100%' },
  placeInfo: { flex: 1, padding: 12, justifyContent: 'center' },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  placeName: { fontFamily: 'Outfit-Bold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  placeCategory: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 8,
  },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeRating: { fontFamily: 'Outfit-Bold', fontSize: 12, color: theme.colors.TEXT_PRIMARY },
  placeDistText: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
  placeOpenPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
  },
  placeOpenText: { fontFamily: 'Inter-Bold', fontSize: 10, color: theme.colors.G },

  // Bottom Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.DARK,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.GLASS_BORDER,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  sheetReset: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL },
  applyBtn: {
    backgroundColor: theme.colors.G,
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
})); const sStylesheet=stylesheet; const s=StyleSheet.create((theme) => ({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 26 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  submissionBox: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  submissionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: 28 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
    marginBottom: 12,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel: { fontSize: 14 },
  sectionTitle: { fontSize: 18, marginTop: 24, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  commName: { fontSize: 15, flexShrink: 1 },
  commMeta: { fontSize: 12, marginBottom: 2 },
  commDesc: { fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 240 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  createModal: { maxHeight: '90%', borderRadius: 18, borderWidth: 1, padding: 18 },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    fontSize: 14,
  },
  descriptionInput: { minHeight: 90, textAlignVertical: 'top' },
  imagePickerRow: {
    minHeight: 76,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerPickerRow: {
    minHeight: 86,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPreview: { width: 54, height: 54, borderRadius: 27 },
  bannerPreview: { width: 110, height: 62, borderRadius: 8 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  privacyOptions: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  privacyOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  modalAction: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
}));
function CatalogEventCard({ item, router, theme, sStylesheet }: any) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user && item.id) {
      supabase
        .from('event_bookmarks')
        .select('id')
        .eq('event_id', item.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setSaved(!!data));
    }
  }, [user, item.id]);

  const toggleSave = async () => {
    if (!user) return;
    const newSaved = !saved;
    setSaved(newSaved);

    if (newSaved) {
      const { error } = await supabase
        .from('event_bookmarks')
        .insert({ event_id: item.id, user_id: user.id });
      if (error) setSaved(false);
    } else {
      const { error } = await supabase
        .from('event_bookmarks')
        .delete()
        .match({ event_id: item.id, user_id: user.id });
      if (error) setSaved(true);
    }
  };

  return (
    <TouchableOpacity
      style={sStylesheet.eventCard}
      onPress={() => router.push(`/events/${item.id}` as any)}
      activeOpacity={0.9}
    >
      <View style={sStylesheet.eventCardImgWrap}>
        <Image
          source={
            item.cover_image_url || item.image_url
              ? { uri: item.cover_image_url || item.image_url }
              : undefined
          }
          style={sStylesheet.eventCardImg}
          contentFit="cover"
        />

        <View style={sStylesheet.eventCardDate}>
          <Text style={sStylesheet.eventCardDateText}>
            {new Date(item.start_time || item.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity style={sStylesheet.eventCardSave} onPress={toggleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={saved ? theme.colors.G : '#FFFFFF'}
          />
        </TouchableOpacity>
        <View style={sStylesheet.eventCardPrice}>
          <Text style={sStylesheet.eventCardPriceText}>
            {item.is_free ? 'FREE' : item.price ? formatPrice(item.price) : 'TICKETS'}
          </Text>
        </View>
      </View>
      <View style={sStylesheet.eventCardInfo}>
        <Text style={sStylesheet.eventCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={sStylesheet.eventCardMetaRow}>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="time-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>
              {item.start_time
                ? new Date(item.start_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : item.time || '10:00 AM'}
            </Text>
          </View>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="location-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>
              {item.location_address || item.location || 'Location TBA'}
            </Text>
          </View>
          <View style={sStylesheet.eventCardMetaItem}>
            <Ionicons name="people-outline" size={12} color={theme.colors.LABEL} />
            <Text style={sStylesheet.eventCardMetaText}>
              {item.attendee_count ?? item.attendees?.length ?? 0} going
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
function MarketplaceCard({item}) {
            return (
              <TouchableOpacity
                style={sStylesheet.marketplaceCard}
                onPress={() => router.push(`/marketplace/${item.id}` as any)}
                activeOpacity={0.9}
              >
                <View style={sStylesheet.marketplaceCardImgWrap}>
                  {(() => {
                    const imgUrl = Array.isArray(item.image_urls)
                      ? item.image_urls[0]
                      : item.image_url;
                    return imgUrl ? (
                      <Image
                        source={{ uri: imgUrl }}
                        style={sStylesheet.marketplaceCardImg}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          sStylesheet.marketplaceCardImg,
                          { backgroundColor: theme.colors.SURFACE_ALT },
                        ]}
                      />
                    );
                  })()}
                  <MarketplaceFavorite item={item} />
                  <View style={sStylesheet.marketplaceCardCond}>
                    <Text style={sStylesheet.marketplaceCardCondText}>
                      {item.condition || 'Good'}
                    </Text>
                  </View>
                </View>
                <Text style={sStylesheet.marketplaceCardTitle} numberOfLines={1}>
                  {item.title || item.text || 'Item'}
                </Text>
                <Text style={sStylesheet.marketplaceCardPrice}>{formatPrice(item.price || 0)}</Text>
                <View style={sStylesheet.marketplaceCardSeller}>
                  <View style={sStylesheet.marketplaceCardAvatarWrap}>
                    {item.user?.avatar_url ? (
                      <Image
                        source={{ uri: item.user.avatar_url }}
                        style={sStylesheet.marketplaceCardAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          sStylesheet.marketplaceCardAvatar,
                          {
                            backgroundColor: theme.colors.G,
                            justifyContent: 'center',
                            alignItems: 'center',
                          },
                        ]}
                      >
                        <Text style={{ color: theme.colors.DARK, fontSize: 10, fontWeight: '700' }}>
                          {(item.user?.name || item.author_name || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={sStylesheet.marketplaceCardArea} numberOfLines={1}>
                    {item.user?.home_lga ||
                      (typeof item.user?.location === 'object' ? item.user?.location?.lga : null) ||
                      'Lagos'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }
function BusinessCard({item}) {
            return (
              <TouchableOpacity
                style={sStylesheet.placeRow}
                onPress={() => router.push(`/businesses/${item.id}` as any)}
                activeOpacity={0.9}
              >
                <View style={sStylesheet.placePhotoWrap}>
                  <Avatar
                    url={
                      (item as any).logo_url ||
                      item.logo ||
                      item.cover_image ||
                      item.image_urls?.[0]
                    }
                    name={item.name}
                    style={sStylesheet.placePhoto}
                  />
                </View>
                <View style={sStylesheet.placeInfo}>
                  <View style={sStylesheet.placeTitleRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                      <Text style={sStylesheet.placeName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {/* Verification badge strictly bound to phone_verified */}
                      {(item as any).phone_verified && (
                        <View style={{ marginLeft: 2 }}>
                          <VerifiedBadge size={14} />
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name="heart-outline"
                      size={16}
                      color={theme.colors.LABEL}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                  <Text style={sStylesheet.placeCategory}>{item.category || 'Business'}</Text>
                  <View style={sStylesheet.placeMetaRow}>
                    <View style={sStylesheet.placeMetaItem}>
                      <Ionicons name="star" size={12} color={theme.colors.GOLD} />
                      <Text style={sStylesheet.placeRating}>
                        {item.rating?.toFixed(1) || '0.0'}
                      </Text>
                    </View>
                    <Text style={sStylesheet.placeDistText}>
                      {getDistanceStr(
                        currentLoc?.coords.latitude,
                        currentLoc?.coords.longitude,
                        item.lat ??
                          item.location?.geopoint?.latitude ??
                          (item.location as any)?.lat,
                        item.lng ??
                          item.location?.geopoint?.longitude ??
                          (item.location as any)?.lng
                      )}
                    </Text>
                    <View style={sStylesheet.placeOpenPill}>
                      <Text style={sStylesheet.placeOpenText}>OPEN</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }
function CommunityCard({item}) {return (
            <TouchableOpacity
              style={[
                s.card,
                {
                  backgroundColor: 'transparent',
                  borderColor: theme.colors.GLASS_BORDER,
                  borderWidth: 0,
                  borderBottomWidth: 1,
                  marginBottom: 0,
                },
              ]}
              activeOpacity={0.82}
              onPress={() => router.push(`/communities/${item.id}` as any)}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: theme.colors.G + '22' }]}>
                  <UsersThree size={22} color={theme.colors.G} weight="fill" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text
                    style={[
                      s.commName,
                      { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.privacy === 'invite' && (
                    <Lock size={13} color={theme.colors.LABEL} weight="fill" />
                  )}
                </View>
                <Text
                  style={[s.commMeta, { color: theme.colors.LABEL, fontFamily: 'Inter-Regular' }]}
                >
                  {item.member_count} {item.member_count === 1 ? 'member' : 'members'} ·{' '}
                  {item.type === 'ward' ? 'Ward' : item.type === 'lga' ? 'LGA' : 'Group'}
                </Text>
                {item.description ? (
                  <Text
                    style={[
                      s.commDesc,
                      { color: theme.colors.TEXT_SECONDARY, fontFamily: 'Inter-Regular' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <ArrowRight size={18} color={theme.colors.LABEL} />
            </TouchableOpacity>
          );}
exports.cards={CatalogEventCard,MarketplaceCard,BusinessCard,CommunityCard};exports.styles=stylesheet;