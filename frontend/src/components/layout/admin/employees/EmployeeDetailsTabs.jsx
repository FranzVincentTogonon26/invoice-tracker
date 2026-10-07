import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "../../../ui/Tabs";
import { PANEL_EASE, TAB_META } from "../../../../lib/employeeDetailsTabs";
import EmployeeTransaction from "./EmployeeTransaction";
import EmployeeBudget from "./EmployeeBudget";
import EmployeeExpenses from "./EmployeeExpenses";
import EmployeeAbono from "./EmployeeAbono";

export function EmployeeDetailsTabs({ tab, onTabChange, direction, employeeId }) {
  // Unknown tab values (stale state, bad link) fall back to the first panel
  // instead of rendering a blank area.
  const safeTab = TAB_META.some((t) => t.value === tab)
    ? tab
    : TAB_META[0].value;
  return (
    <Tabs value={safeTab} onValueChange={onTabChange} className="space-y-3">
        <div className="sticky top-0 z-10 bg-[var(--bg)]/90 py-2 backdrop-blur-sm md:-mx-1 md:px-1">
          <TabsList className="scrollbar-slim w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto sm:self-start">
            {TAB_META.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="grow px-3 sm:grow-0 sm:px-4"
              >
                <Icon
                  size={14}
                  aria-hidden
                  className="hidden shrink-0 sm:block"
                />
                <span className="whitespace-nowrap text-xs font-medium">
                  {label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Soft edge so content fades out beneath the frosted bar on scroll. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-full h-2 bg-[linear-gradient(to_bottom,var(--bg),transparent)]"
          />
        </div>

        {/* Direct AnimatePresence control (not TabsContent) so the exit animation can play. */}
        <div className="relative">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={safeTab}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.28, ease: PANEL_EASE }}
            >
              {safeTab === "employee_transaction" && (
                <EmployeeTransaction userId={employeeId} />
              )}
              {safeTab === "employee_budget" && (
                <EmployeeBudget userId={employeeId} />
              )}
              {safeTab === "employee_expenses" && (
                <EmployeeExpenses userId={employeeId} />
              )}
              {safeTab === "employee_abono" && (
                <EmployeeAbono userId={employeeId} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
  );
}

export default EmployeeDetailsTabs;
