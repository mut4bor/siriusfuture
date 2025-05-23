interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const Input = ({ value, onChange, placeholder }: Props) => {
  return (
    <input
      className="bg-[#555] text-white p-2 rounded hover:bg-[#444] active:bg-[#333] cursor-pointer"
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
};

export default Input;
