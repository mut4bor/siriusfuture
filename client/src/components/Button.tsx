interface Props {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const Button = ({ children, onClick, disabled, className }: Props) => {
  return (
    <button
      className={`bg-[#555] text-white p-2 rounded cursor-pointer font-semibold ${className}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
};

export default Button;
