"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ar" | "es";

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations = {
    en: {
        settings: "SETTINGS",
        customize_profile: "Customize your profile.",
        avatar: "Avatar",
        username: "Username",
        education_stage: "Education Stage",
        save_changes: "SAVE CHANGES",
        saved: "SAVED!",
        saving: "SAVING...",
        appearance: "Appearance",
        light: "Light",
        dark: "Dark",
        auto: "Auto",
        language: "Language",
        home: "Home",
        levels: "Levels",
        social: "Social",
        chat: "Chat",
        profile: "Profile",
        study: "Study",
    },
    ar: {
        settings: "الإعدادات",
        customize_profile: "تخصيص ملفك الشخصي.",
        avatar: "الصورة الرمزية",
        username: "اسم المستخدم",
        education_stage: "المرحلة التعليمية",
        save_changes: "حفظ التغييرات",
        saved: "تم الحفظ!",
        saving: "جاري الحفظ...",
        appearance: "المظهر",
        light: "فاتح",
        dark: "داكن",
        auto: "تلقائي",
        language: "اللغة",
        home: "الرئيسية",
        levels: "المستويات",
        social: "التواصل",
        chat: "الدردشة",
        profile: "الملف الشخصي",
        study: "المذاكرة",
    },
    es: {
        settings: "AJUSTES",
        customize_profile: "Personaliza tu perfil.",
        avatar: "Avatar",
        username: "Nombre de usuario",
        education_stage: "Etapa educativa",
        save_changes: "GUARDAR CAMBIOS",
        saved: "¡GUARDADO!",
        saving: "GUARDANDO...",
        appearance: "Apariencia",
        light: "Claro",
        dark: "Oscuro",
        auto: "Auto",
        language: "Idioma",
        home: "Inicio",
        levels: "Niveles",
        social: "Social",
        chat: "Chat",
        profile: "Perfil",
        study: "Estudiar",
    },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>("en");

    // Load language from localStorage if available
    useEffect(() => {
        const savedLang = localStorage.getItem("app-language") as Language;
        if (savedLang && (savedLang === "en" || savedLang === "ar" || savedLang === "es")) {
            setLanguage(savedLang);
        }
    }, []);

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem("app-language", lang);
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = lang;
    };

    const t = (key: string) => {
        return translations[language][key as keyof typeof translations["en"]] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
