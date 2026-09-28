import { localeSchema } from "@treido/contracts";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
const locale = localeSchema.parse("en");
export default function BootstrapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text
        accessibilityRole="header"
        accessibilityLanguage={locale}
        style={styles.title}
      >
        Treido bootstrap
      </Text>
      <Text>
        Native foundation. Product screens and services are not implemented.
      </Text>
    </SafeAreaView>
  );
}
// Temporary neutral bootstrap values; source-measured styling starts in Task 3.
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: "600" },
});
