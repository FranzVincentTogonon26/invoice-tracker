import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import EmployeeAccount from "../../components/layout/employee/setting/EmployeeAccount";
import EmployeeChangePassword from "../../components/layout/employee/setting/EmployeeChangePassword";

import { useEmployeeSettings } from "../../hooks/useEmployeeSettings";

const TAB_META = [
  { value: "account", label: "Account" },
  { value: "change_password", label: "Password" },
];

// The curve the rest of the app already animates with (shells, dialogs).
const PANEL_EASE = [0.16, 1, 0.3, 1];

const EmployeeSetting = () => {
  const [tab, setTab] = useState("account");
  // Direction the panel slides: +1 when moving right in TAB_META, -1 back.
  const [direction, setDirection] = useState(1);

  const { user, isLoading } = useEmployeeSettings();

  const changeTab = (value) => {
    if (value === tab) return;
    const nextIndex = TAB_META.findIndex((t) => t.value === value);
    const currentIndex = TAB_META.findIndex((t) => t.value === tab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setTab(value);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Setting"
        description="Manage your account and preferences."
      />

      <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
        <div className="sticky top-0 z-10 bg-[var(--bg)]/90 py-1.5 backdrop-blur-sm md:-mx-1 md:px-1">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto sm:self-start">
              {TAB_META.map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="grow px-2.5 sm:grow-0 sm:px-4"
                >
                  <span className="whitespace-nowrap">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {/* Panels are rendered here (not through TabsContent) so the exit
            animation can play: AnimatePresence keeps the outgoing panel
            mounted until its transition ends. */}
        <div className="relative">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={tab}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.28, ease: PANEL_EASE }}
            >
              {tab === "account" ? (
                <EmployeeAccount user={user} loading={isLoading} />
              ) : (
                <EmployeeChangePassword />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
};

export default EmployeeSetting;
