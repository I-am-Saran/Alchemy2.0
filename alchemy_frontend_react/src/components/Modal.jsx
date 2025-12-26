import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import Button from "./ui/Button";
import { THEME_COLORS } from "../constants/colors";

export default function Modal({ open, onClose, title, children, confirmText = "Confirm", onConfirm }) {
  return (
    <Dialog open={open} handler={onClose} dismiss={{ enabled: true }} className="z-50">
      {title && (
        <DialogHeader 
          className="text-lg font-semibold rounded-t-lg"
          style={{ 
            backgroundColor: THEME_COLORS.darkTeal,
            color: '#ffffff',
            padding: '1rem 1.5rem'
          }}
        >
          {title}
        </DialogHeader>
      )}
      <DialogBody className="w-full mx-4 max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 text-gray-800">
        {children}
      </DialogBody>
      <DialogFooter 
        className="gap-2 px-6 pb-6 rounded-b-lg"
        style={{ 
          backgroundColor: THEME_COLORS.offWhite,
          borderTop: `1px solid ${THEME_COLORS.lightBlue}`
        }}
      >
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm || onClose}>{confirmText}</Button>
      </DialogFooter>
    </Dialog>
  );
}