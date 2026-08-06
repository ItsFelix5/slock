export interface ViewProfileButtonProps {
  onClose: () => void;
  onViewProfile: () => void;
}

export default function ViewProfileButton(props: ViewProfileButtonProps) {
  return (
    <button
      class="user-hovercard-btn btn-reset flex-center"
      onClick={() => {
        props.onClose();
        props.onViewProfile();
      }}
      type="button"
    >
      View profile
    </button>
  );
}
