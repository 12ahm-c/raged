/**
 * رجوع آمن للصفحة السابقة:
 * إذا كان هناك مسار سابق نرجع إليه، وإلا ننتقل إلى الشاشة الرئيسية.
 * يمنع تحذير "GO_BACK was not handled by any navigator" عند فتح الشاشة
 * كمسار أول (deep-link أو من لوحة المرحلة).
 */
interface BackNavigationLike {
  canGoBack(): boolean;
  goBack(): void;
  navigate(...args: never[]): void;
}

export function goBackSafe(navigation: BackNavigationLike): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate('Main' as never);
  }
}
