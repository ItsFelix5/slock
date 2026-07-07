// Groups STANDARD_EMOJI's keys for the emoji picker. Every key must appear exactly
// once — verified by a script during development, not at runtime (this is static data).
export const EMOJI_CATEGORIES: { label: string; names: string[] }[] = [
  {
    label: 'Smileys & People',
    names: [
      'smile', 'smiley', 'grinning', 'grin', 'joy', 'rofl', 'laughing', 'wink', 'blush',
      'slightly_smiling_face', 'upside_down_face', 'relaxed', 'heart_eyes', 'kissing_heart', 'yum',
      'sunglasses', 'thinking', 'thinking_face', 'sob', 'cry', 'angry', 'rage', 'scream', 'confused',
      'neutral_face', 'expressionless', 'unamused', 'weary', 'triumph', 'sleeping', 'partying_face',
      'hugs', 'shushing_face', 'zipper_mouth_face', 'nerd_face', 'face_with_monocle', 'exploding_head',
      'loudly_crying_face', 'ghost', 'skull', 'alien', 'robot', 'robot_face', 'poop',
    ],
  },
  {
    label: 'Hearts & Gestures',
    names: [
      'heart', 'yellow_heart', 'green_heart', 'blue_heart', 'purple_heart', 'broken_heart', '+1',
      'thumbsup', '-1', 'thumbsdown', 'ok_hand', 'clap', 'raised_hands', 'pray', 'wave', 'muscle',
      'point_right', 'point_left', 'point_up', 'point_down',
    ],
  },
  {
    label: 'Nature',
    names: [
      'dog', 'cat', 'mouse', 'rabbit', 'bear', 'panda_face', 'koala', 'tiger', 'lion_face', 'cow', 'pig',
      'frog', 'bee', 'bug', 'octopus', 'whale', 'dolphin', 'fish', 'turtle', 'snake', 'dragon', 'unicorn',
      'cloud', 'sunny', 'rainbow', 'snowflake',
    ],
  },
  {
    label: 'Food & Drink',
    names: [
      'coffee', 'beer', 'beers', 'pizza', 'hamburger', 'fries', 'taco', 'popcorn', 'doughnut', 'cookie',
      'cake', 'birthday', 'candy', 'icecream', 'watermelon', 'apple', 'banana', 'strawberry', 'lemon',
      'cherries',
    ],
  },
  {
    label: 'Travel & Objects',
    names: [
      'rocket', 'star', 'star2', 'sparkles', 'boom', 'zap', 'fire', 'tada', 'checkered_flag', 'house',
      'airplane', 'car', 'rocket_ship', 'computer', 'iphone', 'email', 'envelope', 'package', 'gift',
      'calendar', 'clock', 'alarm_clock', 'hourglass', 'lock', 'key', 'hammer', 'wrench', 'gear', 'bulb',
      'moneybag', 'dollar',
    ],
  },
  {
    label: 'Symbols',
    names: [
      'eyes', 'eyes_emoji', 'warning', 'no_entry', 'x', 'white_check_mark', 'heavy_check_mark', 'question',
      'exclamation', 'bangbang', 'arrow_right', 'arrow_left', 'arrow_up', 'arrow_down', 'recycle',
      'infinity', '100',
    ],
  },
];
