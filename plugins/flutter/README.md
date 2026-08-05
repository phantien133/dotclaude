# flutter

Flutter/Dart framework preset. Extends `mobile` with Flutter-specific tools:

- **`dart-flutter-patterns`** — Riverpod 2.x, GoRouter, Freezed, Dio, null safety, testing
- **`flutter-dart-code-review`** — comprehensive library-agnostic review checklist
- **`dart-build-resolver`** agent — fixes `dart analyze` / pub / build_runner errors
- **`flutter-reviewer`** agent — code review specialist for Flutter/Dart
- **Dart rules** — coding style, hooks, patterns, security, testing

## Stack assumptions

Riverpod 2.x (`AsyncNotifierProvider`, `NotifierProvider`), GoRouter, Freezed,
custom HTTP/GraphQL client (Dio or `dart:io`), feature-first `lib/features/` layout.

## Extends

`mobile` → `developer` → `ai-native` → `core`
