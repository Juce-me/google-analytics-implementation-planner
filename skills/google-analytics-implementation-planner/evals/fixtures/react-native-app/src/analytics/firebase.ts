import analytics from "@react-native-firebase/analytics";

export async function setAnalyticsConsent(granted: boolean) {
  await analytics().setAnalyticsCollectionEnabled(granted);
}
