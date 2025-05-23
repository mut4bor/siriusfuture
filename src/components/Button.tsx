interface Props {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

const Button = ({ children, onClick, disabled }: Props) => {
  return (
    <button
      className="bg-[#555] text-white p-2 rounded hover:bg-[#444] active:bg-[#333] cursor-pointer"
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
};

export default Button;
