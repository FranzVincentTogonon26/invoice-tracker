// Shared table-row motion — ONE animation vocabulary for every ledger
// table in the app, so creating, deleting, filtering or paging rows feels
// identical everywhere.
//
// Pattern (mirrors the SourceTable rows this was extracted from):
//   <AnimatePresence initial={false}>
//     {rows.map((row) => (
//       <motion.tr
//         key={row.id}
//         layout
//         initial="hidden"
//         animate="visible"
//         exit={{ opacity: 0 }}
//         variants={tableRowVariants}
//         className="..."
//       >
// `initial={false}` keeps the first paint still — only inserts, removals
// and reorders animate. `layout` lets surviving rows glide when siblings
// leave; `exit` fades the removed row without shifting the table first.
export const tableRowVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};
