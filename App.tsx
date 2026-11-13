import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

type Tab = "chat" | "settings";
type RuleKey = "concise" | "friendly" | "explain" | "codeFirst" | "matchLanguage";
type Message = { id: string; role: "user" | "assistant"; content: string };

const STORAGE_KEY = "pocketllm.settings.v1";
const DEFAULT_PROMPT = "You are a helpful assistant running locally on the user's device. Be accurate, clear, and honest about uncertainty.";

const RULES: { key: RuleKey; title: string; description: string; instruction: string }[] = [
  { key: "concise", title: "Keep it concise", description: "Prefer short, direct answers.", instruction: "Prefer concise answers unless detail is requested." },
  { key: "friendly", title: "Friendly tone", description: "Be approachable and respectful.", instruction: "Use a friendly, respectful tone." },
  { key: "explain", title: "Explain steps", description: "Break down complicated tasks.", instruction: "Explain useful steps clearly; do not claim hidden reasoning." },
  { key: "codeFirst", title: "Code-first answers", description: "Prioritize examples for programming questions.", instruction: "For programming questions, include practical code examples when useful." },
  { key: "matchLanguage", title: "Match my language", description: "Reply in the language I use.", instruction: "Respond in the same language as the user's latest message unless asked otherwise." }
];

type Settings = {
  systemPrompt: string;
  rules: Record<RuleKey, boolean>;
  archivistUnlocked: boolean;
  archivistEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: DEFAULT_PROMPT,
  rules: { concise: false, friendly: true, explain: true, codeFirst: false, matchLanguage: true },
  archivistUnlocked: false,
  archivistEnabled: false
};

function buildSystemPrompt(settings: Settings): string {
  const active = RULES.filter(rule => settings.rules[rule.key]).map(rule => `- ${rule.instruction}`);
  const personality = settings.archivistEnabled && settings.archivistUnlocked
    ? "\\n\\nPERSONALITY: The Archivist. You are a curious, calm keeper of knowledge. You speak with a subtle archival flair, occasionally calling useful facts 'entries'. Stay helpful and never let the character override safety, accuracy, or the user's actual request."
    : "";
  return [settings.systemPrompt.trim(), active.length ? "\\nADDITIONAL RULES:\\n" + active.join("\\n") : "", personality].join("\\n").trim();
}

function AppContent() {
  const [tab, setTab] = useState<Tab>("chat");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<Settings>;
          setSettings({
            ...DEFAULT_SETTINGS,
            ...saved,
            rules: { ...DEFAULT_SETTINGS.rules, ...(saved.rules || {}) }
          });
        } catch { /* Ignore invalid saved settings and use defaults. */ }
      }
    }).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {
      Alert.alert("Storage issue", "PocketLLM couldn't save your settings on this device.");
    });
  }, [settings, loaded]);

  const effectivePrompt = useMemo(() => buildSystemPrompt(settings), [settings]);

  function updateRule(key: RuleKey, value: boolean) {
    setSettings(current => ({ ...current, rules: { ...current.rules, [key]: value } }));
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages(current => [...current, { id: `${Date.now()}`, role: "user", content: text }]);
    setDraft("");
    Alert.alert(
      "AI engine not connected yet",
      "Your message is shown in this prototype. Next we'll connect the on-device llama.cpp inference engine."
    );
  }

  function handleLogoTap() {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (next >= 7) {
      setLogoTaps(0);
      setSettings(current => {
        if (!current.archivistUnlocked) {
          Alert.alert("Secret discovered", "You've found The Archivist. A new personality is now available in Settings.");
          return { ...current, archivistUnlocked: true };
        }
        Alert.alert("The Archivist", "Some entries are best discovered twice.");
        return current;
      });
    }
  }

  if (!loaded) {
    return <View style={styles.loading}><ActivityIndicator color="#A78BFA" /><Text style={styles.muted}>Loading PocketLLM…</Text></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={handleLogoTap} accessibilityRole="button" accessibilityLabel="PocketLLM home">
          <Text style={styles.brand}>Pocket<Text style={styles.brandAccent}>LLM</Text></Text>
        </Pressable>
        <View style={styles.headerRight}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>LOCAL</Text>
        </View>
      </View>

      {tab === "chat" ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.chatContent}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.orb}><Text style={styles.orbText}>✦</Text></View>
                <Text style={styles.title}>Your AI. Your device.</Text>
                <Text style={styles.mutedCenter}>Choose a model to start chatting locally. Your conversations will stay on your device.</Text>
                <View style={styles.engineCard}>
                  <Text style={styles.engineTitle}>NO MODEL LOADED</Text>
                  <Text style={styles.engineBody}>The chat interface is ready. The local inference engine is the next milestone.</Text>
                </View>
              </View>
            ) : messages.map(message => (
              <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
                <Text style={styles.messageRole}>{message.role === "user" ? "YOU" : "POCKETLLM"}</Text>
                <Text style={styles.messageText}>{message.content}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message your local AI…"
              placeholderTextColor="#77758A"
              style={styles.input}
              multiline
              maxLength={8000}
            />
            <Pressable onPress={sendMessage} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.sectionLabel}>AI BEHAVIOR</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Custom system prompt</Text>
            <Text style={styles.cardDescription}>Set the base instructions given to your local model.</Text>
            <TextInput
              value={settings.systemPrompt}
              onChangeText={value => setSettings(current => ({ ...current, systemPrompt: value }))}
              multiline
              textAlignVertical="top"
              placeholder="Tell your AI how to behave…"
              placeholderTextColor="#77758A"
              style={styles.promptInput}
            />
            <Pressable onPress={() => setShowPromptPreview(value => !value)} style={styles.previewButton}>
              <Text style={styles.previewButtonText}>{showPromptPreview ? "Hide" : "Preview"} effective system prompt</Text>
            </Pressable>
            {showPromptPreview && <Text selectable style={styles.promptPreview}>{effectivePrompt}</Text>}
            <Pressable onPress={() => setSettings(current => ({ ...current, systemPrompt: DEFAULT_PROMPT }))}>
              <Text style={styles.resetText}>Reset to default prompt</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>INDIVIDUAL RULES</Text>
          <View style={styles.card}>
            {RULES.map((rule, index) => (
              <View key={rule.key}>
                <View style={styles.ruleRow}>
                  <View style={styles.ruleCopy}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    <Text style={styles.cardDescription}>{rule.description}</Text>
                  </View>
                  <Switch
                    value={settings.rules[rule.key]}
                    onValueChange={value => updateRule(rule.key, value)}
                    trackColor={{ false: "#343244", true: "#7656D6" }}
                    thumbColor={settings.rules[rule.key] ? "#FFFFFF" : "#B7B3C7"}
                  />
                </View>
                {index < RULES.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>HIDDEN PERSONALITY</Text>
          <View style={styles.card}>
            {settings.archivistUnlocked ? (
              <>
                <View style={styles.secretHeader}>
                  <Text style={styles.secretIcon}>⌘</Text>
                  <View style={styles.ruleCopy}>
                    <Text style={styles.ruleTitle}>The Archivist</Text>
                    <Text style={styles.cardDescription}>A quiet keeper of knowledge. Secret unlocked.</Text>
                  </View>
                  <Switch
                    value={settings.archivistEnabled}
                    onValueChange={value => setSettings(current => ({ ...current, archivistEnabled: value }))}
                    trackColor={{ false: "#343244", true: "#7656D6" }}
                    thumbColor={settings.archivistEnabled ? "#FFFFFF" : "#B7B3C7"}
                  />
                </View>
                <Text style={styles.secretNote}>This personality is added to the effective system prompt when enabled.</Text>
              </>
            ) : (
              <Text style={styles.cardDescription}>A hidden personality is waiting to be discovered. Keep exploring PocketLLM.</Text>
            )}
          </View>
          <Text style={styles.footerNote}>Settings are stored locally on this device.</Text>
        </ScrollView>
      )}

      <View style={styles.tabBar}>
        <Pressable onPress={() => setTab("chat")} style={styles.tab}>
          <Text style={[styles.tabIcon, tab === "chat" && styles.activeTab]}>◉</Text>
          <Text style={[styles.tabLabel, tab === "chat" && styles.activeTab]}>Chat</Text>
        </Pressable>
        <Pressable onPress={() => setTab("settings")} style={styles.tab}>
          <Text style={[styles.tabIcon, tab === "settings" && styles.activeTab]}>⚙</Text>
          <Text style={[styles.tabLabel, tab === "settings" && styles.activeTab]}>Settings</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0A10" },
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: "#0B0A10", alignItems: "center", justifyContent: "center", gap: 12 },
  header: { height: 62, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: "#24212E", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#F5F2FF", fontSize: 23, fontWeight: "800", letterSpacing: -0.8 },
  brandAccent: { color: "#A78BFA" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: "#8BDBB0" },
  statusText: { color: "#A8A3B7", fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  chatContent: { flexGrow: 1, padding: 20, justifyContent: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 12 },
  orb: { width: 76, height: 76, borderRadius: 25, backgroundColor: "#211A35", borderWidth: 1, borderColor: "#59428B", alignItems: "center", justifyContent: "center", marginBottom: 25 },
  orbText: { color: "#C4B5FD", fontSize: 36 },
  title: { color: "#F5F2FF", fontSize: 25, fontWeight: "700", letterSpacing: -0.7 },
  mutedCenter: { color: "#9691A5", textAlign: "center", lineHeight: 21, marginTop: 10, maxWidth: 290 },
  muted: { color: "#9691A5" },
  engineCard: { backgroundColor: "#15131D", borderColor: "#2D283B", borderWidth: 1, borderRadius: 15, padding: 16, marginTop: 30, width: "100%" },
  engineTitle: { color: "#C4B5FD", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  engineBody: { color: "#A7A1B6", fontSize: 13, lineHeight: 19, marginTop: 7 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#24212E" },
  input: { flex: 1, minHeight: 48, maxHeight: 120, backgroundColor: "#17151F", borderRadius: 16, paddingHorizontal: 15, paddingVertical: 13, color: "#F5F2FF", fontSize: 15 },
  sendButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#8B6BE8", alignItems: "center", justifyContent: "center" },
  sendText: { color: "white", fontSize: 25, fontWeight: "600", marginTop: -2 },
  pressed: { opacity: 0.75 },
  message: { padding: 14, borderRadius: 16, marginVertical: 7, maxWidth: "88%" },
  userMessage: { alignSelf: "flex-end", backgroundColor: "#30264A" },
  assistantMessage: { alignSelf: "flex-start", backgroundColor: "#17151F", borderWidth: 1, borderColor: "#2D283B" },
  messageRole: { color: "#BBA8F7", fontSize: 9, fontWeight: "800", letterSpacing: 1.3, marginBottom: 7 },
  messageText: { color: "#F1EEF8", fontSize: 15, lineHeight: 21 },
  settingsContent: { padding: 20, paddingBottom: 35 },
  pageTitle: { color: "#F5F2FF", fontSize: 29, fontWeight: "800", marginBottom: 25, letterSpacing: -0.8 },
  sectionLabel: { color: "#938DA5", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10, marginTop: 12 },
  card: { backgroundColor: "#15131D", borderColor: "#2D283B", borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 10 },
  cardTitle: { color: "#F4F0FC", fontSize: 16, fontWeight: "700" },
  cardDescription: { color: "#9691A5", fontSize: 12, lineHeight: 17, marginTop: 4 },
  promptInput: { minHeight: 112, backgroundColor: "#0E0D14", borderRadius: 11, borderWidth: 1, borderColor: "#302B3D", color: "#F2EEF9", padding: 12, marginTop: 13, fontSize: 13, lineHeight: 19 },
  previewButton: { marginTop: 12, paddingVertical: 8 },
  previewButtonText: { color: "#BBA8F7", fontSize: 12, fontWeight: "700" },
  promptPreview: { color: "#C4BED2", backgroundColor: "#0E0D14", borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 17, marginTop: 5 },
  resetText: { color: "#A99AEB", fontSize: 12, marginTop: 9 },
  ruleRow: { flexDirection: "row", alignItems: "center", minHeight: 62, gap: 12 },
  ruleCopy: { flex: 1 },
  ruleTitle: { color: "#F4F0FC", fontSize: 14, fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#292533" },
  secretHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  secretIcon: { width: 38, height: 38, textAlign: "center", textAlignVertical: "center", borderRadius: 12, overflow: "hidden", color: "#D8C8FF", backgroundColor: "#302448", fontSize: 20 },
  secretNote: { color: "#9691A5", fontSize: 11, lineHeight: 16, marginTop: 12 },
  footerNote: { color: "#6F6A7D", fontSize: 11, textAlign: "center", marginTop: 14 },
  tabBar: { height: 67, borderTopWidth: 1, borderTopColor: "#24212E", flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingBottom: 3 },
  tab: { alignItems: "center", justifyContent: "center", width: 100, gap: 3 },
  tabIcon: { color: "#777184", fontSize: 19 },
  tabLabel: { color: "#777184", fontSize: 10, fontWeight: "600" },
  activeTab: { color: "#BBA8F7" }
});