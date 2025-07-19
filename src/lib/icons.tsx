import { FaNodeJs, FaPython } from "react-icons/fa";
import { RiNextjsFill, RiInstanceFill } from "react-icons/ri";


export function getIcon(name: string) {
    switch (name) {
        case "nextjs":
        return <RiNextjsFill className="text-blue-600" size={30}/>;
        case "nodejs":
        return <FaNodeJs className="text-green-600" size={30}/>;
        case "python":
        return <FaPython className="text-yellow-600" size={30}/>;
        default: 
        return <RiInstanceFill className="text-gray-600" size={30}/>;
    }
}