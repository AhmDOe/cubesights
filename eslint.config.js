import { FlatCompat } from "@eslint/eslintrc";
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default tseslint.config(
  {
		ignores: ['.next', 'generated', 'playwright-report', 'test-results']
	},
  ...compat.extends("next/core-web-vitals"),
  {
    files: ['**/*.ts', '**/*.tsx'],
		extends: [
			...tseslint.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			...tseslint.configs.stylisticTypeChecked
		],
      rules: {
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/consistent-type-definitions": "off",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
  },
  },
  {
		linterOptions: {
			reportUnusedDisableDirectives: true
		},
		languageOptions: {
			parserOptions: {
				projectService: true
			}
		}
	},
	// Module boundaries (001-R9/R7, 002-R1/R2/R3): src/cube/core is framework-free and must not
	// import React/Next/DOM-facing code or sibling cube/* modules; cubing/twisty may only be
	// imported by CubeView.tsx; vendor BLE libraries may only be imported inside
	// src/cube/input/bluetooth/. Each block below targets a disjoint file set so a single rule
	// definition per block cannot be silently overridden by another block matching the same file.
	{
		files: ["src/cube/core/**/*.ts"],
		rules: {
			"no-restricted-imports": ["error", {
				paths: [
					"react", "react-dom", "next", "cubing/twisty",
					"smartcube-web-bluetooth", "cubing/bluetooth",
				],
				patterns: ["~/cube/input/*", "~/cube/solve/*", "~/components/*", "~/app/*", "~/server/*"],
			}],
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["src/components/CubeView.tsx", "src/cube/core/**"],
		rules: {
			"no-restricted-imports": ["error", { paths: ["cubing/twisty"] }],
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["src/cube/input/bluetooth/**", "src/cube/core/**"],
		rules: {
			"no-restricted-imports": ["error", { paths: ["smartcube-web-bluetooth", "cubing/bluetooth"] }],
		},
	},
)
